import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { prisma } from '@stockboom/database';

/**
 * Admin Guard
 * 관리자 권한 확인 가드
 * 사용자의 email이 admin 목록에 있는지 확인
 */
@Injectable()
export class AdminGuard implements CanActivate {
    // 관리자 이메일 목록 (환경변수나 DB로 관리 권장)
    private readonly adminEmails = [
        'admin@stockboom.com',
        'admin@example.com',
    ];

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('인증이 필요합니다');
        }

        // DB에서 사용자 정보 조회 (isAdmin 필드 확인 가능)
        const dbUser = await prisma.user.findUnique({
            where: { id: user.userId },
        });

        if (!dbUser) {
            throw new ForbiddenException('사용자를 찾을 수 없습니다');
        }

        // 관리자 이메일 확인
        const isAdmin = this.adminEmails.includes(dbUser.email.toLowerCase());

        if (!isAdmin) {
            throw new ForbiddenException('관리자 권한이 필요합니다');
        }

        return true;
    }
}
