import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, Observable, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from '../services/auth-service';
import { UserService } from '../services/user-service';
import { environment } from '../../environments/environment';
import type { LoginResponse } from '../model/user';

let refreshRequest$: Observable<LoginResponse> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const userService = inject(UserService);

  const isApiRequest = req.url.startsWith(environment.api);
  if (!isApiRequest) {
    return next(req);
  }

  const token = auth.currentUser()?.token;
  let requestToSend = req;

  if (token) {
    //req.clone(): create a new request with the same properties as the original request, but with the added headers
    requestToSend = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(requestToSend).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = (error as HttpErrorResponse)?.status === 401;
      const refreshToken = auth.currentUser()?.refreshToken;
      const url = req.url.toLowerCase();
      const isAuthEndpoint =
        url.endsWith('/account/login') || url.endsWith('/account/refresh-token');

      if (!isUnauthorized || !refreshToken || isAuthEndpoint) {
        return throwError(() => error);
      }

      if (!refreshRequest$) {
        refreshRequest$ = userService.refreshToken(refreshToken).pipe(
          tap((response) => {
            if (
              response.statusCode !== 200 ||
              !response.result?.token ||
              !response.result?.refreshToken
            ) {
              throw new Error('Refresh token request failed.');
            }
            auth.setUser(response.result);
          }),
          catchError((refreshError) => {
            auth.logout();
            return throwError(() => refreshError);
          }),
          finalize(() => {
            refreshRequest$ = null;
          }),
          shareReplay(1),
        );
      }

      return refreshRequest$.pipe(
        switchMap((response) => {
          const renewedToken = response.result?.token;
          if (!renewedToken) {
            return throwError(() => error);
          }
          return next(
            req.clone({
              setHeaders: {
                Authorization: `Bearer ${renewedToken}`,
              },
            }),
          );
        }),
      );
    }),
  );
};

//interceptor: like middlewares in .net
