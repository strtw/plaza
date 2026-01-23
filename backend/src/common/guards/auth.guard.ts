import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { clerkClient } from '@clerk/clerk-sdk-node';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    if (!process.env.CLERK_SECRET_KEY) {
      console.error('[AuthGuard] CLERK_SECRET_KEY is not set');
      throw new UnauthorizedException('Server configuration error');
    }

    try {
      const session = await clerkClient.verifyToken(token);
      request.userId = session.sub;
      return true;
    } catch (error: any) {
      console.error('[AuthGuard] Token verification failed:', error.message || 'Invalid token');
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

