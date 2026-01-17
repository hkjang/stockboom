import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * User 데코레이터
 * JWT 인증된 사용자 정보를 주입합니다.
 * 
 * @example
 * @Get('profile')
 * getProfile(@User() user: any) {
 *   return user;
 * }
 */
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export const CurrentUser = User;
