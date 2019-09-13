/*
 * Copyright (c) 2019, Seqera Labs.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */
import { Injectable } from '@angular/core';
import {BehaviorSubject, Observable} from "rxjs";
import {map, tap} from "rxjs/operators";
import {User} from "../entity/user/user";
import {HttpClient} from "@angular/common/http";
import {environment} from "src/environments/environment";
import {UserData} from "../entity/user/user-data";
import {AccessGateResponse} from "../entity/gate";
import {Router} from "@angular/router";
import {JwtAuth} from "../entity/user/jwt-auth";

const authEndpointUrl: string = `${environment.apiUrl}/login`;
const refreshEndpointUrl: string = `${environment.apiUrl}/oauth/access_token`;
const userEndpointUrl: string = `${environment.apiUrl}/user`;
const gateEndpointUrl: string = `${environment.apiUrl}/gate`;

const jwtCookieName: string = 'JWT';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  user$: Observable<User>;
  private userSubject: BehaviorSubject<User>;

  refreshTokenTimerId: number;

  constructor(private http: HttpClient,
              private router: Router) {
    this.userSubject = new BehaviorSubject(this.retrievePersistedUser());
    this.user$ = this.userSubject.asObservable();
  }

  get isUserAuthenticated(): boolean {
    return (this.currentUser != null);
  }

  get currentUser(): User {
    return this.userSubject.value
  }

  auth(email: string, authToken: string): Observable<JwtAuth> {
    return this.http.post(authEndpointUrl, {username: email, password: authToken}).pipe(
      map((authData: any) => {
        const jwtAuth: JwtAuth = this.generateJwtCookieFromAuthData(authData);
        console.log('New auth data', jwtAuth);

        return jwtAuth;
      })
    );
  }

  private generateJwtCookieFromAuthData(authData: any): JwtAuth {
    const jwtAuth: JwtAuth = new JwtAuth(authData.access_token, authData.refresh_token);
    this.setCookie(jwtCookieName, jwtAuth.data.accessToken, jwtAuth.expirationDate);

    return jwtAuth;
  }


  retrieveUserFromServer(jwtAuth: JwtAuth): Observable<User> {
    return this.requestUserProfileInfo().pipe(
      map((data: any) => {
        const userData = <UserData>data.user;
        userData.jwtAuthData = jwtAuth.data;
        return new User(userData);
      }),
      tap((user: User) => this.setAuthUser(user)),
      tap((user: User) => this.scheduleTokenRefresh(user))
    );
  }

  private requestUserProfileInfo(): Observable<UserData> {
    return this.http.get(`${userEndpointUrl}/`).pipe(
      map((data: UserData) => data)
    );
  }

  private setAuthUser(user: User): void {
    this.persistUser(user);
    this.userSubject.next(user);
  }

  private scheduleTokenRefresh(user: User): void {
    const timeUntilExpirationMs: number = user.jwt.expirationDate.getTime() - Date.now();
    if (timeUntilExpirationMs <= 0) {
      return;
    }

    const prudentialTimeBeforeExpirationMs: number = 5 * 60 * 1000;
    const refreshIn: number = (timeUntilExpirationMs - prudentialTimeBeforeExpirationMs > 0) ? timeUntilExpirationMs - prudentialTimeBeforeExpirationMs : 0;
    console.log('Token expire date', user.jwt.expirationDate, 'Refresh scheduled to', new Date(Date.now() + refreshIn));
    this.refreshTokenTimerId = setTimeout(() => {
      this.requestTokenRefresh(user).subscribe();
    }, refreshIn);
  }

  private cancelScheduledTokenRefresh(): void {
    if (this.refreshTokenTimerId == null) {
      return;
    }

    console.log('Canceling scheduled token refresh');
    clearTimeout(this.refreshTokenTimerId);
  }

  private requestTokenRefresh(user: User): Observable<User> {
    return this.http.post(`${refreshEndpointUrl}/`, {grant_type: 'refresh_token', refresh_token: user.jwt.data.refreshToken}).pipe(
      map((authData: any) => {
        const jwtAuth: JwtAuth = this.generateJwtCookieFromAuthData(authData);
        console.log('Refreshed auth data', jwtAuth);

        user.data.jwtAuthData = jwtAuth.data;
        const updatedUser: User = user.generateCopy();
        this.setAuthUser(updatedUser);

        return updatedUser;
      }),
      tap((user: User) => this.scheduleTokenRefresh(user))
    );
  }

  access(email: string): Observable<AccessGateResponse> {
    return this.http.post<AccessGateResponse>(`${gateEndpointUrl}/access`, {email: email})
  }

  update(user: User): Observable<string> {
    return this.http.post(`${userEndpointUrl}/update`, user.data, {responseType: "text"}).pipe(
      map((message: string) => message),
      tap( () => this.setAuthUser(user)),
    );
  }

  delete(): Observable<string> {
    return this.http.delete(`${userEndpointUrl}/delete`, {responseType: "text"}).pipe(
      map((message: string) => message)
    );
  }

  logoutAndGoHome() {
    this.logout();
    this.router.navigate(['/']);
  }

  private logout(): void {
    this.removeUser();
    this.deleteCookie(jwtCookieName);
    this.cancelScheduledTokenRefresh();
    this.userSubject.next(null);
  }


  private deleteCookie(cookieName: string) {
    this.setCookie(cookieName, '', new Date(0));
  }

  private setCookie(cookieName: string, cookieValue: string, expireDate: Date) {
    document.cookie = `${cookieName}=${cookieValue}=;expires=${expireDate.toString()};`;
  }


  private persistUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user.data));
  }

  private retrievePersistedUser(): User {
    const userData: UserData = <UserData> JSON.parse(localStorage.getItem('user'));
    const user: User = userData ? new User(userData) : null;

    if (user) {
      this.scheduleTokenRefresh(user);
    }

    return user;
  }

  private removeUser(): void {
    localStorage.removeItem('user');
  }
}
