import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../../../prisma/prisma.service';

export class DepartmentDto {
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  @IsOptional() @IsString() parentDepartmentId?: string;
  @IsOptional() @IsString() headId?: string;
  @IsOptional() @IsBoolean() isGroup?: boolean;
}

export class DesignationDto {
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateDepartmentDto extends PartialType(DepartmentDto) {}
export class UpdateDesignationDto extends PartialType(DesignationDto) {}

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService) {}

  // departments
  async departments(companyId: string) {
    const rows = await this.prisma.department.findMany({
      where: { companyId }, orderBy: { name: 'asc' }, include: { _count: { select: { employees: true } } },
    });
    return rows.map((d) => ({ ...d, employeeCount: d._count.employees, _count: undefined }));
  }

  async departmentTree(companyId: string) {
    const rows = await this.departments(companyId);
    type DepartmentNode = (typeof rows)[number] & { children: DepartmentNode[] };
    const map = new Map<string, DepartmentNode>(rows.map((r) => [r.id, { ...r, children: [] }]));
    const roots: DepartmentNode[] = [];
    for (const r of rows) {
      const node = map.get(r.id);
      const parent = r.parentDepartmentId ? map.get(r.parentDepartmentId) : null;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }

  private async checkParent(companyId: string, id: string | null, parentId?: string) {
    if (!parentId) return;
    if (parentId === id) throw new BadRequestException('A department cannot be its own parent');
    if (!(await this.prisma.department.findFirst({ where: { id: parentId, companyId } }))) throw new BadRequestException('Parent department not found');
    let cur: string | null | undefined = parentId;
    while (cur && id) {
      if (cur === id) throw new BadRequestException('Department hierarchy cannot contain a cycle');
      cur = (await this.prisma.department.findUnique({ where: { id: cur }, select: { parentDepartmentId: true } }))?.parentDepartmentId;
    }
  }

  async createDepartment(companyId: string, dto: DepartmentDto) {
    await this.checkParent(companyId, null, dto.parentDepartmentId);
    return this.prisma.department.create({ data: { ...dto, companyId } });
  }

  async updateDepartment(companyId: string, id: string, dto: UpdateDepartmentDto) {
    const d = await this.prisma.department.findFirst({ where: { id, companyId } });
    if (!d) throw new NotFoundException('Department not found');
    await this.checkParent(companyId, id, dto.parentDepartmentId);
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async deleteDepartment(companyId: string, id: string) {
    const d = await this.prisma.department.findFirst({ where: { id, companyId }, include: { _count: { select: { employees: true, childDepartments: true } } } });
    if (!d) throw new NotFoundException('Department not found');
    if (d._count.employees) throw new BadRequestException('Reassign the employees in this department before deleting it');
    if (d._count.childDepartments) throw new BadRequestException('Delete or move the sub-departments first');
    await this.prisma.department.delete({ where: { id } });
    return { ok: true };
  }

  // designations
  async designations(companyId: string) {
    const rows = await this.prisma.designation.findMany({ where: { companyId }, orderBy: { name: 'asc' }, include: { _count: { select: { employees: true } } } });
    return rows.map((d) => ({ ...d, employeeCount: d._count.employees, _count: undefined }));
  }

  createDesignation(companyId: string, dto: DesignationDto) {
    return this.prisma.designation.create({ data: { ...dto, companyId } });
  }

  async updateDesignation(companyId: string, id: string, dto: UpdateDesignationDto) {
    if (!(await this.prisma.designation.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Designation not found');
    return this.prisma.designation.update({ where: { id }, data: dto });
  }

  async deleteDesignation(companyId: string, id: string) {
    const d = await this.prisma.designation.findFirst({ where: { id, companyId }, include: { _count: { select: { employees: true } } } });
    if (!d) throw new NotFoundException('Designation not found');
    if (d._count.employees) throw new BadRequestException('Reassign employees with this designation before deleting it');
    await this.prisma.designation.delete({ where: { id } });
    return { ok: true };
  }
}
