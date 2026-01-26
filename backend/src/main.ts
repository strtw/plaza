import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Enable CORS for mobile app access
  app.enableCors({
    origin: true, // Allow all origins (mobile apps don't have same-origin restrictions, but this helps with development)
    credentials: true,
  });
  // Listen on all network interfaces (0.0.0.0) to allow mobile device access
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
