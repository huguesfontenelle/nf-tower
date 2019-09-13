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
import {UserData} from "./user-data";
import {JwtAuth} from "./jwt-auth";

export class User {

  data: UserData;
  jwt: JwtAuth;

  constructor(userData: UserData) {
    this.data = userData;
    this.jwt = new JwtAuth(userData.jwtAuthData.accessToken, userData.jwtAuthData.refreshToken);
  }

  get avatar(): string {
    return (this.data.avatar || '/assets/avatar_placeholder.png');
  }

  get nameToDisplay(): string {
    return (this.data.firstName && this.data.lastName) ? `${this.data.firstName} ${this.data.lastName}` : this.data.userName;
  }

  generateCopy(): User {
    let userDataCopy: UserData = JSON.parse(JSON.stringify(this.data));

    return new User(userDataCopy)
  }

}
