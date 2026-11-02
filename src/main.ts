import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Prefixo global para a API
  app.setGlobalPrefix('api');

  // CORS
  const frontendEnv = process.env.FRONTEND_URL?.trim();
  const allowedOrigins = [
    frontendEnv,
    frontendEnv && !frontendEnv.startsWith('http') ? `https://${frontendEnv}` : null,
    frontendEnv && !frontendEnv.startsWith('http') ? `http://${frontendEnv}` : null,
    'https://nexoassist.danielazevedom.com.br',
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  });

  // Global Pipes & Interceptors conforme Guia de Arquitetura
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Nexo Assist API')
    .setDescription(
      'API do Service Desk de TI da Nexo com Assistente Inteligente Nexo Assist',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Nexo Assist API rodando na porta ${port}`);
  console.log(`📄 Swagger Docs disponível em http://localhost:${port}/api/docs`);
}

bootstrap().catch(console.error);

