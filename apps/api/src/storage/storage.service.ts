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
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
  private readonly s3?: S3Client;
  private readonly localUploadRoot = join(tmpdir(), 'community-ai-uploads');
  private readonly minioEndpoint?: string;
  private storageMode: 's3' | 'local' = 'local';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'community-ai',
    );
    this.minioEndpoint =
      this.configService.get<string>('MINIO_ENDPOINT')?.trim() || undefined;

    if (this.minioEndpoint) {
      this.s3 = new S3Client({
        region: 'us-east-1',
        endpoint: `http://${this.minioEndpoint}:${this.configService.get<string>('MINIO_PORT', '9000')}`,
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
  }

  async onModuleInit() {
    if (!this.s3) {
      await mkdir(this.localUploadRoot, { recursive: true });
      this.logger.warn(
        'MinIO is not configured. Falling back to local attachment storage for this deployment.',
      );
      return;
    }

    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.storageMode = 's3';
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.storageMode = 's3';
      } catch (error) {
        this.storageMode = 'local';
        await mkdir(this.localUploadRoot, { recursive: true });
        this.logger.warn(
          `Bucket bootstrap skipped. Falling back to local attachment storage. ${String(error)}`,
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

    const persistedStorageKey =
      this.storageMode === 's3'
        ? storageKey
        : await this.saveLocally(storageKey, file.buffer);

    if (this.storageMode === 's3' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    }

    return this.prisma.attachment.create({
      data: {
        uploadedByUserId: actor.sub,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: persistedStorageKey,
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

    if (attachment.storageKey.startsWith('local/')) {
      const localPath = join(
        this.localUploadRoot,
        attachment.storageKey.replace(/^local\//, ''),
      );

      return {
        stream: createReadStream(localPath),
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
      };
    }

    if (!this.s3) {
      throw new NotFoundException(
        'This attachment is unavailable because object storage is not configured.',
      );
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

  private async saveLocally(storageKey: string, buffer: Buffer) {
    const localKey = `local/${storageKey}`;
    const filePath = join(this.localUploadRoot, storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return localKey;
  }
}
