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
  private readonly storageProvider: 'aws' | 'minio' | 'none' = 'none';
  private storageMode: 's3' | 'local' = 'local';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const explicitProvider = this.readConfig('STORAGE_PROVIDER')?.toLowerCase();
    const awsBucket =
      this.readConfig('AWS_S3_BUCKET') ??
      this.readConfig('AWS_BUCKET_NAME') ??
      this.readConfig('S3_BUCKET');
    const awsRegion =
      this.readConfig('AWS_REGION') ??
      this.readConfig('AWS_DEFAULT_REGION') ??
      'us-east-1';
    const awsAccessKeyId = this.readConfig('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = this.readConfig('AWS_SECRET_ACCESS_KEY');
    const canUseAws = Boolean(
      awsBucket && awsAccessKeyId && awsSecretAccessKey,
    );
    const awsConfig = canUseAws
      ? {
          bucket: awsBucket!,
          accessKeyId: awsAccessKeyId!,
          secretAccessKey: awsSecretAccessKey!,
          region: awsRegion,
        }
      : undefined;

    this.minioEndpoint = this.readConfig('MINIO_ENDPOINT');
    const minioAccessKey =
      this.readConfig('MINIO_ACCESS_KEY') ?? 'minioadmin';
    const minioSecretKey =
      this.readConfig('MINIO_SECRET_KEY') ?? 'minioadmin';
    const minioBucket =
      this.readConfig('MINIO_BUCKET') ?? 'community-ai';
    const minioPort = this.readConfig('MINIO_PORT') ?? '9000';
    const minioProtocol = this.readBooleanConfig('MINIO_USE_SSL')
      ? 'https'
      : 'http';
    const canUseMinio = Boolean(this.minioEndpoint);

    if (explicitProvider === 'aws' || (!explicitProvider && canUseAws)) {
      if (!awsConfig) {
        this.bucket = awsBucket ?? minioBucket;
        return;
      }

      this.bucket = awsConfig.bucket;
      this.storageProvider = 'aws';
      this.s3 = new S3Client({
        region: awsConfig.region,
        credentials: {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
        },
      });
      return;
    }

    if (explicitProvider === 'minio' || (!explicitProvider && canUseMinio)) {
      if (!canUseMinio) {
        this.bucket = minioBucket;
        return;
      }

      this.bucket = minioBucket;
      this.storageProvider = 'minio';
      this.s3 = new S3Client({
        region: awsRegion,
        endpoint: `${minioProtocol}://${this.minioEndpoint}:${minioPort}`,
        credentials: {
          accessKeyId: minioAccessKey,
          secretAccessKey: minioSecretKey,
        },
        forcePathStyle: true,
      });
      return;
    }

    this.bucket = minioBucket;
  }

  async onModuleInit() {
    if (!this.s3) {
      await mkdir(this.localUploadRoot, { recursive: true });
      this.logger.warn(
        'Object storage is not configured. Falling back to local attachment storage for this deployment.',
      );
      return;
    }

    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.storageMode = 's3';
      this.logger.log(
        `Using ${this.storageProvider.toUpperCase()} object storage bucket "${this.bucket}".`,
      );
    } catch {
      if (this.storageProvider === 'minio') {
        try {
          await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.storageMode = 's3';
          this.logger.log(`Created MinIO bucket "${this.bucket}".`);
          return;
        } catch (error) {
          this.logger.warn(
            `MinIO bucket bootstrap skipped. Falling back to local attachment storage. ${String(error)}`,
          );
        }
      }

      this.storageMode = 'local';
      await mkdir(this.localUploadRoot, { recursive: true });
      this.logger.warn(
        `Bucket check failed for ${this.storageProvider.toUpperCase()} bucket "${this.bucket}". Falling back to local attachment storage.`,
      );
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

  private readConfig(key: string) {
    return this.configService.get<string>(key)?.trim() || undefined;
  }

  private readBooleanConfig(key: string) {
    const value = this.readConfig(key)?.toLowerCase();
    return value === 'true' || value === '1' || value === 'yes';
  }
}
