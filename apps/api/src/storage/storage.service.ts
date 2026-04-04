import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import type { Express } from 'express';
import type { AuthTokenPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly s3: S3Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'community-ai',
    );
    this.s3 = new S3Client({
      region: 'us-east-1',
      endpoint: `http://${this.configService.get<string>('MINIO_ENDPOINT', 'localhost')}:${this.configService.get<string>('MINIO_PORT', '9000')}`,
      credentials: {
        accessKeyId: this.configService.get<string>(
          'MINIO_ACCESS_KEY',
          'minioadmin',
        ),
        secretAccessKey: this.configService.get<string>(
          'MINIO_SECRET_KEY',
          'minioadmin',
        ),
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (error) {
        this.logger.warn(
          `Bucket bootstrap skipped. Ensure MinIO is available before uploading files. ${String(error)}`,
        );
      }
    }
  }

  async uploadAttachment(actor: AuthTokenPayload, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A file is required.');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Upload a PDF, image, DOCX, or PPTX.',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Files must be 10MB or smaller.');
    }

    const storageKey = `${actor.homeOrganizationId ?? 'platform'}/${actor.sub}/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return this.prisma.attachment.create({
      data: {
        uploadedByUserId: actor.sub,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
      },
    });
  }

  async getDownload(actor: AuthTokenPayload, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        post: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    if (!attachment.post) {
      if (attachment.uploadedByUserId !== actor.sub) {
        throw new ForbiddenException('This attachment is not available yet.');
      }
    } else {
      const { group } = attachment.post;
      const canAccess =
        group.visibilityScope === 'global_public' ||
        actor.homeOrganizationId === group.ownerOrganizationId ||
        actor.platformRole === 'platform_admin';

      if (!canAccess) {
        throw new ForbiddenException(
          'You do not have access to this attachment.',
        );
      }
    }

    const objectResponse = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: attachment.storageKey,
      }),
    );

    return {
      stream: objectResponse.Body as Readable,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }
}
