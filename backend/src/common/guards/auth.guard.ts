import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { clerkClient } from '@clerk/clerk-sdk-node';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor() {
    // Check if CLERK_SECRET_KEY is set on initialization
    if (!process.env.CLERK_SECRET_KEY) {
      console.error('[AuthGuard] WARNING: CLERK_SECRET_KEY is not set in environment variables');
    } else {
      const keyPreview = process.env.CLERK_SECRET_KEY.substring(0, 10) + '...';
      console.log('[AuthGuard] CLERK_SECRET_KEY is set:', keyPreview);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      console.error('[AuthGuard] No token provided');
      throw new UnauthorizedException('No token provided');
    }

    // Double-check CLERK_SECRET_KEY is available
    if (!process.env.CLERK_SECRET_KEY) {
      console.error('[AuthGuard] ERROR: CLERK_SECRET_KEY is not set');
      throw new UnauthorizedException('Server configuration error: CLERK_SECRET_KEY not set');
    }

    try {
      const session = await clerkClient.verifyToken(token);
      request.userId = session.sub;
      console.log('[AuthGuard] Token verified successfully for user:', session.sub);
      return true;
    } catch (error: any) {
      console.error('[AuthGuard] Token verification failed:', error.message || error);
      console.error('[AuthGuard] Error details:', JSON.stringify(error, null, 2));
      
      // Check if it's a secret key issue
      if (error.reason === 'secret-key-invalid' || error.message?.includes('Secret Key')) {
        console.error('[AuthGuard] CLERK_SECRET_KEY appears to be invalid or not loaded');
        console.error('[AuthGuard] Current CLERK_SECRET_KEY preview:', process.env.CLERK_SECRET_KEY?.substring(0, 10) + '...');
      }
      
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

