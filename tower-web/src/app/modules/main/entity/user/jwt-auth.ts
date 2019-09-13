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
import {JwtAuthData} from "./jwt-auth-data";
import {JwtPayload} from "./jwt-payload";

export class JwtAuth {

  data: JwtAuthData;
  payload: JwtPayload;

  constructor(accessToken: string, refreshToken: string) {
    this.data = <JwtAuthData>{accessToken: accessToken, refreshToken: refreshToken};
    this.payload = this.parseJwt(accessToken);
    console.log('The JWT payload', this.payload);
  }

  get isValid(): boolean {
    return (this.payload != null);
  }

  get expirationDate(): Date {
    return new Date(this.payload.exp * 1000)
  }

  get creationDate(): Date {
    return new Date(this.payload.iat * 1000)
  }

  private parseJwt(jwt: string): any {
    try {
      return JSON.parse(atob(jwt.split('.')[1]));
    } catch (e) {
      console.log('Exception while parsing JWT', e);
      return null;
    }
  };

}
