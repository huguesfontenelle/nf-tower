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
import {BehaviorSubject, Observable, of, Subject} from "rxjs";
import {map, mergeMap, tap} from "rxjs/operators";
import {User} from "../entity/user/user";
import {HttpClient} from "@angular/common/http";
import {environment} from "src/environments/environment";
import {UserData} from "../entity/user/user-data";
import {AccessGateResponse} from "../entity/gate";
import {Router} from "@angular/router";
import {JwtAuth} from "../entity/user/jwt-auth";
import {JwtAuthData} from "../entity/user/jwt-auth-data";

const authEndpointUrl: string = `${environment.apiUrl}/login`;
const refreshEndpointUrl: string = `${environment.apiUrl}/oauth`;
const userEndpointUrl: string = `${environment.apiUrl}/user`;
const gateEndpointUrl: string = `${environment.apiUrl}/gate`;

const jwtCookieName: string = 'JWT';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  user$: Observable<User>;

  private userSubject: BehaviorSubject<User>;

  constructor(private http: HttpClient,
              private router: Router) {
    this.userSubject = new BehaviorSubject(this.getPersistedUser());
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
        console.log('The auth data', authData);
        const jwtAuth: JwtAuth = new JwtAuth(authData.access_token, authData.refresh_token);
        this.setCookie(jwtCookieName, jwtAuth.data.accessToken, jwtAuth.expirationDate);

        return jwtAuth;
      }));
  }

  retrieveUser(jwtAuth: JwtAuth): Observable<User> {
    return this.requestUserProfileInfo().pipe(
      map((userData: UserData) => {
        userData.jwtAuthData = jwtAuth.data;
        const user: User = new User(userData);
        this.setAuthUser(user);

        return user;
      })
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

  private scheduleTokenRefresh(user: User) {

  }

  // private requestTokenRefresh(): Observable<User> {
  //   return this.http.get(`${refreshEndpointUrl}/`).pipe(
  //
  //   );
  // }

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
    this.userSubject.next(null);
  }


  private getCookieValue(cookieName: string) {
    const allCookies: string[] = document.cookie.split(';');
    const cookiePair: string[] = allCookies.map((cookie: string) => cookie.split('='))
                     .find((cookiePair: string[]) => {
                       return cookiePair[0] == cookieName;
                     });

    cookiePair ? cookiePair[1] : '';
  }

  private deleteCookie(cookieName: string) {
    this.setCookie(cookieName, '', new Date(0));
  }

  private setCookie(cookieName: string, cookieValue: string, expireDate: Date) {
    console.log('Setting cookie', `${cookieName}=${cookieValue}=;expires=${expireDate.toString()};`);
    document.cookie = `${cookieName}=${cookieValue}=;expires=${expireDate.toString()};`;
    console.log('Set cookie', document.cookie);
  }


  private persistUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user.data));
  }

  private getPersistedUser(): User {
    const userData: UserData = <UserData> JSON.parse(localStorage.getItem('user'));

    return (userData ? new User(userData) : null);
  }

  private removeUser(): void {
    localStorage.removeItem('user');
  }
}
