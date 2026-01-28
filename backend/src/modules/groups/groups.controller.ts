import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  private async getPlazaUserId(req: any): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { clerkId: req.userId },
      select: { id: true },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user.id;
  }

  @Get()
  async getGroups(@Request() req, @Query('memberId') memberId?: string) {
    try {
      const ownerId = await this.getPlazaUserId(req);
      if (memberId) {
        return this.groupsService.getGroupsForUser(ownerId, memberId);
      }
      return this.groupsService.getMyGroups(ownerId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Internal server error',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async createGroup(@Request() req, @Body() dto: CreateGroupDto) {
    try {
      const ownerId = await this.getPlazaUserId(req);
      return this.groupsService.createGroup(ownerId, dto.name);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Internal server error',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getGroup(@Request() req, @Param('id') groupId: string) {
    try {
      const ownerId = await this.getPlazaUserId(req);
      return this.groupsService.getGroup(ownerId, groupId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error?.status === 404) throw error;
      throw new HttpException(
        error?.message || 'Internal server error',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/members')
  async addMember(
    @Request() req,
    @Param('id') groupId: string,
    @Body() dto: AddMemberDto,
  ) {
    try {
      const ownerId = await this.getPlazaUserId(req);
      return this.groupsService.addMember(ownerId, groupId, dto.userId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error?.status === 404) throw error;
      throw new HttpException(
        error?.message || 'Internal server error',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Request() req,
    @Param('id') groupId: string,
    @Param('userId') userId: string,
  ) {
    try {
      const ownerId = await this.getPlazaUserId(req);
      return this.groupsService.removeMember(ownerId, groupId, userId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error?.status === 404) throw error;
      throw new HttpException(
        error?.message || 'Internal server error',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
