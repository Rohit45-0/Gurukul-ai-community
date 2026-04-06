import {
  ModerationActionType,
  ReportTargetType,
  VisibilityScope,
} from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(280)
  description!: string;

  @IsEnum(VisibilityScope)
  @IsOptional()
  visibilityScope?: VisibilityScope;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(280)
  description?: string;
}

export class UpdateVisibilityDto {
  @IsEnum(VisibilityScope)
  visibilityScope!: VisibilityScope;
}

export class CreatePostDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  body!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentIds?: string[];
}

export class CreateCommentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1200)
  body!: string;

  @IsString()
  @IsOptional()
  parentCommentId?: string;
}

export class ToggleReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  emoji!: string;
}

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reason!: string;

  @IsString()
  @MaxLength(800)
  @IsOptional()
  details?: string;

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsString()
  @IsOptional()
  postId?: string;

  @IsString()
  @IsOptional()
  commentId?: string;
}

export class TakeModerationActionDto {
  @IsEnum(ModerationActionType)
  action!: ModerationActionType;

  @IsString()
  @IsOptional()
  reportId?: string;

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsString()
  @IsOptional()
  postId?: string;

  @IsString()
  @IsOptional()
  commentId?: string;

  @IsString()
  @MaxLength(600)
  @IsOptional()
  note?: string;
}
