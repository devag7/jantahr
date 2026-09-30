import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import * as multer from 'multer';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthUser, ADMIN_ROLES, TEAM_VIEW_ROLES } from '../../../common/types';
import { MAX_UPLOAD_BYTES, StorageService } from '../../../common/storage/storage.service';
import { CreateEmployeeDto, EmployeeFilterDto, ImportEmployeesDto, SetStatusDto, UpdateEmployeeDto, UpdateSelfDto, UploadDocumentDto } from './employee.dto';
import { EmployeesService } from './employees.service';

const upload = FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

@Controller('employees')
export class EmployeesController {
  constructor(private service: EmployeesService, private storage: StorageService) {}

  @Roles(...TEAM_VIEW_ROLES)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() filter: EmployeeFilterDto) {
    return this.service.list(user, filter);
  }

  @Get('directory')
  directory(@CurrentUser() user: AuthUser, @Query('search') search?: string, @Query('departmentId') departmentId?: string) {
    return this.service.directory(user, search, departmentId);
  }

  @Get('org-chart')
  orgChart(@CurrentUser() user: AuthUser) {
    return this.service.orgChart(user);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.service.getMe(user);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateSelfDto) {
    return this.service.updateSelf(user, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Post('import')
  import(@CurrentUser() user: AuthUser, @Body() dto: ImportEmployeesDto) {
    return this.service.importCsv(user, dto.csv);
  }

  @Roles(...ADMIN_ROLES)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.service.create(user, dto);
  }

  @Get('documents/:docId/download')
  async download(@CurrentUser() user: AuthUser, @Param('docId') docId: string, @Req() req: Request, @Res() res: Response) {
    const { key, name } = await this.service.downloadDocument(user, docId);
    await this.storage.send(req, res, key, name);
  }

  @Roles(...ADMIN_ROLES)
  @Post('documents/:docId/verify')
  verify(@CurrentUser() user: AuthUser, @Param('docId') docId: string) {
    return this.service.verifyDocument(user, docId);
  }

  @Delete('documents/:docId')
  removeDoc(@CurrentUser() user: AuthUser, @Param('docId') docId: string) {
    return this.service.deleteDocument(user, docId);
  }

  @Get(':id')
  one(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/status')
  status(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.service.setStatus(user, id, dto.status);
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resetPassword(user, id);
  }

  @Get(':id/documents')
  documents(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listDocuments(user, id);
  }

  @Post(':id/documents')
  @UseInterceptors(upload)
  addDocument(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UploadDocumentDto, @UploadedFile() file?: Express.Multer.File, @Body('upload') ticket?: string) {
    return this.service.addDocument(user, id, dto, file, ticket);
  }
}
