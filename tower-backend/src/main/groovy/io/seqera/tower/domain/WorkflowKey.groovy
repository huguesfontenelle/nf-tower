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

package io.seqera.tower.domain

import java.time.OffsetDateTime

import grails.gorm.annotation.Entity
import groovy.transform.CompileDynamic

@Entity
@CompileDynamic
class WorkflowKey {
    Long id
    String sessionId
    String workflowId
    OffsetDateTime dateCreated
    OffsetDateTime lastUpdated

    static constraints = {
        sessionId(nullable: true, maxSize: 36)
        workflowId(nullable: true, unique: true)
    }
}
