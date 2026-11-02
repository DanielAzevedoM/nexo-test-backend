import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T> | T> {
    return next.handle().pipe(
      map((result) => {
        // Se for nulo ou indefinido
        if (result === undefined || result === null) {
          return { data: null } as any;
        }

        // Se já tiver a propriedade 'data' (por exemplo, retorno paginado)
        if (typeof result === 'object' && 'data' in result) {
          return result;
        }

        // Envelopa em { data: result }
        return { data: result };
      }),
    );
  }
}

