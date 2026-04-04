import { OrganizationRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrganizationRole)
  @IsOptional()
  role?: OrganizationRole;

  @IsString()
  @IsOptional()
  organizationId?: string;
}

export class AcceptInviteDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}
