import { Injectable } from '@nestjs/common';
import { prisma, User, Prisma } from '@stockboom/database';

@Injectable()
export class UsersService {
    async create(data: Prisma.UserCreateInput): Promise<User> {
        return prisma.user.create({ data });
    }

    async findById(id: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id },
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return prisma.user.update({
            where: { id },
            data,
        });
    }

    async updateLastLogin(id: string): Promise<User> {
        return prisma.user.update({
            where: { id },
            data: { lastLoginAt: new Date() },
        });
    }

    async delete(id: string): Promise<User> {
        return prisma.user.delete({
            where: { id },
        });
    }
}
