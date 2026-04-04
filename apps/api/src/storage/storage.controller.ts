import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthTokenPayload } from '../auth/auth.types';
import { StorageService } from './storage.service';

@Controller()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('uploads')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  upload(
    @CurrentUser() actor: AuthTokenPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.storageService.uploadAttachment(actor, file);
  }

  @Get('uploads/:attachmentId')
  @UseGuards(JwtAuthGuard)
  async download(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.storageService.getDownload(actor, attachmentId);

    response.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${file.fileName}"`,
    });

    return new StreamableFile(file.stream);
  }
}
