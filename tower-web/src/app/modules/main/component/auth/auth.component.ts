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

import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {AuthService} from "../../service/auth.service";
import {User} from "../../entity/user/user";
import {JwtAuth} from "../../entity/user/jwt-auth";
import {NotificationService} from "../../service/notification.service";
import {HttpErrorResponse} from "@angular/common/http";

@Component({
  selector: 'wt-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {

  constructor(private route: ActivatedRoute,
              private router: Router,
              private authService: AuthService,
              private notificationService: NotificationService
              ) {
  }

  email: string;
  authToken: string;

  ngOnInit() {
    this.prepareAuthParams();
    this.doAuth();
  }

  private prepareAuthParams(): void {
    const queryParams: ParamMap = this.route.snapshot.queryParamMap;
    this.email = queryParams.get('email');
    this.authToken = queryParams.get('authToken');
  }

  private doAuth(): void {
    console.log('Authenticating with', this.email, this.authToken);
    this.authService.auth(this.email, this.authToken).subscribe((jwtAuth: JwtAuth) => {
      if (!jwtAuth.isValid) {
        this.handleUnsuccessfulLogin('There was an error parsing the JWT auth token');
        return;
      }

      this.authService.retrieveUser(jwtAuth).subscribe(
        (user: User) => this.handleSuccessfulLogin(user),
        (error: HttpErrorResponse) => this.handleUnsuccessfulLogin('Bad credentials')
      );
    });
  }

  private handleUnsuccessfulLogin(errorMessage: string): void {
    this.notificationService.showErrorNotification(errorMessage);
    this.authService.logoutAndGoHome();
  }

  private handleSuccessfulLogin(user: User) {
    console.log('Logged in as', user);
    this.router.navigate(['']);
  }

}
