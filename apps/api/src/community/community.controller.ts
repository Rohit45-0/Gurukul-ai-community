import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthTokenPayload } from '../auth/auth.types';
import { CommunityService } from './community.service';
import {
  CreateCommentDto,
  CreateGroupDto,
  CreatePostDto,
  CreateReportDto,
  TakeModerationActionDto,
  ToggleReactionDto,
  UpdateGroupDto,
  UpdateVisibilityDto,
} from './dto/community.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('groups')
  listGroups(@CurrentUser() actor: AuthTokenPayload) {
    return this.communityService.listOrganizationGroups(actor);
  }

  @Post('groups')
  createGroup(
    @CurrentUser() actor: AuthTokenPayload,
    @Body() dto: CreateGroupDto,
  ) {
    return this.communityService.createGroup(actor, dto);
  }

  @Get('groups/:groupId')
  getGroup(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('groupId') groupId: string,
  ) {
    return this.communityService.getGroup(actor, groupId);
  }

  @Patch('groups/:groupId')
  updateGroup(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.communityService.updateGroup(actor, groupId, dto);
  }

  @Patch('groups/:groupId/visibility')
  updateVisibility(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.communityService.updateVisibility(actor, groupId, dto);
  }

  @Get('public-groups')
  listPublicGroups(@CurrentUser() actor: AuthTokenPayload) {
    return this.communityService.listPublicGroups(actor);
  }

  @Post('groups/:groupId/join')
  joinGroup(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('groupId') groupId: string,
  ) {
    return this.communityService.joinGroup(actor, groupId);
  }

  @Get('feeds/organization')
  getOrganizationFeed(@CurrentUser() actor: AuthTokenPayload) {
    return this.communityService.getOrganizationFeed(actor);
  }

  @Get('feeds/public-joined')
  getJoinedPublicFeed(@CurrentUser() actor: AuthTokenPayload) {
    return this.communityService.getJoinedPublicFeed(actor);
  }

  @Get('groups/:groupId/posts')
  getGroupPosts(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('groupId') groupId: string,
  ) {
    return this.communityService.getGroupPosts(actor, groupId);
  }

  @Post('groups/:groupId/posts')
  createPost(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('groupId') groupId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.communityService.createPost(actor, groupId, dto);
  }

  @Post('posts/:postId/comments')
  addComment(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.addComment(actor, postId, dto);
  }

  @Post('posts/:postId/reactions')
  togglePostReaction(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('postId') postId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.communityService.togglePostReaction(actor, postId, dto);
  }

  @Post('comments/:commentId/reactions')
  toggleCommentReaction(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('commentId') commentId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.communityService.toggleCommentReaction(actor, commentId, dto);
  }

  @Post('posts/:postId/bookmark')
  toggleBookmark(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('postId') postId: string,
  ) {
    return this.communityService.toggleBookmark(actor, postId);
  }

  @Get('search')
  search(@CurrentUser() actor: AuthTokenPayload, @Query('q') query: string) {
    return this.communityService.search(actor, query ?? '');
  }

  @Post('reports')
  createReport(
    @CurrentUser() actor: AuthTokenPayload,
    @Body() dto: CreateReportDto,
  ) {
    return this.communityService.createReport(actor, dto);
  }

  @Get('reports')
  listReports(@CurrentUser() actor: AuthTokenPayload) {
    return this.communityService.listReports(actor);
  }

  @Post('moderation/actions')
  moderate(
    @CurrentUser() actor: AuthTokenPayload,
    @Body() dto: TakeModerationActionDto,
  ) {
    return this.communityService.takeModerationAction(actor, dto);
  }
}
