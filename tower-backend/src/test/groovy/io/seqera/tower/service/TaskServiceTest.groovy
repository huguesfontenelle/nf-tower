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

package io.seqera.tower.service

import grails.gorm.PagedResultList
import grails.gorm.transactions.Transactional
import io.micronaut.test.annotation.MicronautTest
import io.seqera.tower.Application
import io.seqera.tower.domain.Task
import io.seqera.tower.domain.Workflow
import io.seqera.tower.enums.TaskStatus
import io.seqera.tower.exceptions.NonExistingWorkflowException
import io.seqera.tower.exchange.trace.TraceTaskRequest
import io.seqera.tower.util.AbstractContainerBaseTest
import io.seqera.tower.util.DomainCreator
import io.seqera.tower.util.TaskTraceSnapshotStatus
import io.seqera.tower.util.TracesJsonBank
import spock.lang.Unroll

import javax.inject.Inject

@MicronautTest(application = Application.class)
@Transactional
class TaskServiceTest extends AbstractContainerBaseTest {

    @Inject
    TaskService taskService

    void 'should find a task workflow id and hash' () {
        given:
        def creator = new DomainCreator()
        def wf1 = creator.createWorkflow(sessionId: 'aaa-1')
        def wf2 = creator.createWorkflow(sessionId: 'zzz-1')

        def t1 = creator.createTask(workflow: wf1, hash: 'abc', name: 'foo')
        def t2 = creator.createTask(workflow: wf2, hash: 'xyz', name: 'bar')
        def t3 = creator.createTask(workflow: wf2, data: t1.data)

        when:
        def result = taskService.getTaskDataBySessionIdAndHash('aaa-1', 'abc')
        then:
        result.name == 'foo'
        result.hash == 'abc'

        when:
        result = taskService.getTaskDataBySessionIdAndHash('zzz-1', 'xyz')
        then:
        result.name == 'bar'
        result.hash == 'xyz'
        
        when:
        result = taskService.getTaskDataBySessionIdAndHash('aaa-1', 'xyz')
        then:
        !result
    }

    void "submit a task given a submit trace"() {
        given: 'create the workflow for the task'
        def workflow = new DomainCreator().createWorkflow()

        and: "a task JSON submitted trace"
        TraceTaskRequest taskTraceJson = TracesJsonBank.extractTaskJsonTrace('success', 1, workflow.id, TaskTraceSnapshotStatus.SUBMITTED)

        when: "unmarshall the JSON to a task"
        List<Task> tasks = Task.withNewTransaction { taskService.processTaskTraceRequest(taskTraceJson) }
        Task task = tasks[0]

        then: "the task has been correctly saved"
        tasks.size() == 1
        task.id
        task.checkIsSubmitted()
        task.submit
        !task.start
        !task.complete
        Task.withNewTransaction { Task.count() } == 1
        
    }

    void "submit a task given a submit trace, then start the task given a start trace, last complete the task given a success trace"() {
        given: 'create the workflow for the task'
        Workflow workflow = new DomainCreator().createWorkflow()

        and: "a task submitted trace"
        TraceTaskRequest taskSubmittedTraceJson = TracesJsonBank.extractTaskJsonTrace('success', 1, workflow.id, TaskTraceSnapshotStatus.SUBMITTED)

        and: 'a task started trace'
        TraceTaskRequest taskStartedTrace = TracesJsonBank.extractTaskJsonTrace('success', 1, workflow.id, TaskTraceSnapshotStatus.RUNNING)

        and: 'a task succeeded trace'
        TraceTaskRequest taskSucceededTraceJson = TracesJsonBank.extractTaskJsonTrace('success', 1, workflow.id, TaskTraceSnapshotStatus.SUCCEEDED)

        when: "unmarshall the JSON to a task"
        List<Task> tasks
        Task.withNewTransaction {
            tasks = taskService.processTaskTraceRequest(taskSubmittedTraceJson)
        }
        Task taskSubmitted = tasks[0]

        then: "the workflow has been correctly saved"
        tasks.size() == 1
        taskSubmitted.id
        taskSubmitted.checkIsSubmitted()
        taskSubmitted.submit
        !taskSubmitted.start
        !taskSubmitted.complete
        Task.withNewTransaction {
            Task.count() == 1
        }

        when: "unmarshall the started task trace"
        tasks = Task.withNewTransaction {
             taskService.processTaskTraceRequest(taskStartedTrace)
        }
        Task taskStarted = tasks[0]

        then: "the task has been started"
        tasks.size() == 1
        taskStarted.id == taskSubmitted.id
        taskStarted.checkIsRunning()
        taskStarted.submit
        taskStarted.start
        !taskStarted.complete
        Task.withNewTransaction {
            Task.count() == 1
        }

        when: "unmarshall the succeeded task trace"
        Task.withNewTransaction {
            tasks = taskService.processTaskTraceRequest(taskSucceededTraceJson)
        }
        Task taskCompleted = tasks[0]

        then: "the task has been started"
        tasks.size() == 1
        taskCompleted.id == taskSubmitted.id
        taskCompleted.checkIsSucceeded()
        taskCompleted.submit
        taskCompleted.start
        taskCompleted.complete
        Task.withNewTransaction {
            Task.count() == 1
        }
        
    }

    void "submit a task given a submit trace, then start the task given a start trace, last complete the task given a fail trace"() {
        given: 'create the workflow for the task'
        Workflow workflow = new DomainCreator().createWorkflow()

        and: "a task submitted trace"
        TraceTaskRequest taskSubmittedTraceJson = TracesJsonBank.extractTaskJsonTrace('failed', 1, workflow.id, TaskTraceSnapshotStatus.SUBMITTED)

        and: 'a task started trace'
        TraceTaskRequest taskStartedTrace = TracesJsonBank.extractTaskJsonTrace('failed', 1, workflow.id, TaskTraceSnapshotStatus.RUNNING)

        and: 'a task succeeded trace'
        TraceTaskRequest taskFailedTraceJson = TracesJsonBank.extractTaskJsonTrace('failed', 1, workflow.id, TaskTraceSnapshotStatus.FAILED)

        when: "unmarshall the JSON to a task"
        List<Task> tasks
        Task.withNewTransaction {
            tasks = taskService.processTaskTraceRequest(taskSubmittedTraceJson)
        }
        Task taskSubmitted = tasks[0]

        then: "the workflow has been correctly saved"
        tasks.size() == 1
        taskSubmitted.id
        taskSubmitted.checkIsSubmitted()
        taskSubmitted.submit
        !taskSubmitted.start
        !taskSubmitted.complete
        Task.withNewTransaction {
            Task.count() == 1
        }

        when: "unmarshall the started task trace"
        Task.withNewTransaction {
            tasks = taskService.processTaskTraceRequest(taskStartedTrace)
        }
        Task taskStarted = tasks[0]

        then: "the task has been started"
        taskStarted.id == taskSubmitted.id
        Task.withNewTransaction {
            Task.count() == 1
        }
        taskStarted.checkIsRunning()
        taskStarted.submit
        taskStarted.start
        !taskStarted.complete

        when: "unmarshall the succeeded task trace"
        Task.withNewTransaction {
            tasks = taskService.processTaskTraceRequest(taskFailedTraceJson)
        }
        Task taskCompleted = tasks[0]

        then: "the task has been started"
        tasks.size() == 1
        taskCompleted.id == taskSubmitted.id
        taskCompleted.checkIsFailed()
        taskCompleted.submit
        taskCompleted.start
        taskCompleted.complete
        taskCompleted.errorAction
        Task.withNewTransaction {
            Task.count() == 1
        }

    }

    void "submit a task given a running trace without previous submitted trace"() {
        given: 'create the workflow for the task'
        Workflow workflow = new DomainCreator().createWorkflow()

        and: "a task JSON submitted trace"
        TraceTaskRequest taskTraceJson = TracesJsonBank.extractTaskJsonTrace('success', 1, workflow.id, TaskTraceSnapshotStatus.RUNNING)

        when: "unmarshall the JSON to a task"
        List<Task> tasks
        Task.withNewTransaction {
            tasks = taskService.processTaskTraceRequest(taskTraceJson)
        }
        Task task = tasks[0]

        then: "the task has been correctly saved"
        tasks.size() == 1
        task.id
        task.checkIsRunning()
        task.submit
        task.start
        !task.complete
        Task.withNewTransaction {
            Task.count() == 1
        }
    }

    void "submit several tasks at once with a multitask trace"() {
        given: 'create the workflow for the task'
        Workflow workflow = new DomainCreator().createWorkflow()

        and: "a task JSON submitted trace"
        TraceTaskRequest taskTraceJson = TracesJsonBank.extractTaskJsonTrace('multitasks', 3567912, workflow.id, TaskTraceSnapshotStatus.MULTITASK)

        when: "unmarshall the JSON to a task list"
        List<Task> tasks
        Task.withNewTransaction {
            tasks = taskService.processTaskTraceRequest(taskTraceJson)
        }

        then: "the tasks have been correctly saved"
        tasks.size() == 6
        tasks.every { it.status == TaskStatus.RUNNING }
        Task.withNewTransaction {
            Task.count() == 6
        }
    }

    void "try to submit a task without taskId"() {
        given: 'create the workflow for the task'
        Workflow workflow = new DomainCreator().createWorkflow()

        and: "a task submitted trace without taskId"
        TraceTaskRequest taskSubmittedTraceJson = TracesJsonBank.extractTaskJsonTrace('success', 1, workflow.id, TaskTraceSnapshotStatus.SUBMITTED)
        taskSubmittedTraceJson.tasks*.taskId = null

        when: "unmarshall the JSON to a task"
        List<Task> tasks = Task.withNewTransaction { taskService.processTaskTraceRequest(taskSubmittedTraceJson) }
        Task taskSubmitted = tasks[0]

        then: "the task has a validation error"
        tasks.size() == 1
        taskSubmitted.hasErrors()
        taskSubmitted.errors.getFieldError('taskId').code == 'nullable'
        Task.withNewTransaction { Task.count()  } == 0
    }

    void "try to submit a task given a submit trace for a non existing workflow"() {
        given: "a task submitted trace"
        TraceTaskRequest taskSubmittedTraceJson = TracesJsonBank.extractTaskJsonTrace('success', 1, null, TaskTraceSnapshotStatus.SUBMITTED)

        when: "unmarshall the JSON to a task"
        List<Task> tasks
        Task.withNewTransaction {
            tasks = taskService.processTaskTraceRequest(taskSubmittedTraceJson)
        }

        then: "the workflow doesn't exist"
        thrown(NonExistingWorkflowException)
        Task.withNewTransaction {
            Task.count() == 0
        }
    }

    @Unroll
    void "find some tasks belonging to a workflow"() {
        given: 'a first task'
        Task firstTask = new DomainCreator().createTask(taskId: 1)
        List<Task> tasks = [firstTask]

        and: 'extract its workflow'
        Workflow workflow = firstTask.workflow

        and: 'generate more tasks associated with the workflow'
        (2..nTasks).each {
            tasks << new DomainCreator().createTask(workflow: workflow, taskId: it)
        }

        when: 'search for the tasks associated with the workflow'
        PagedResultList<Task> obtainedTasks = taskService.findTasks(workflow.id, max, offset, orderProperty, orderDirection, null)

        then: 'the obtained tasks are as expected'
        obtainedTasks.totalCount == nTasks
        obtainedTasks.size() == max
        obtainedTasks.id == tasks.sort { t1, t2 ->
            (orderDirection == 'asc') ? t1[orderProperty] <=> t2[orderProperty] : t2[orderProperty] <=> t1[orderProperty]
        }[offset..<(offset + max)].id

        where: 'the pagination params are'
        nTasks | max | offset | orderProperty | orderDirection
        20     | 10  | 0      | 'hash'        | 'asc'
        20     | 10  | 10     | 'hash'        | 'asc'
        20     | 10  | 0      | 'hash'        | 'desc'
        20     | 10  | 10     | 'hash'        | 'desc'
    }

    @Unroll
    void "search tasks belonging to a workflow by text"() {
        given: 'a first task'
        Task firstTask = new DomainCreator().createTask(taskId: 1, status: TaskStatus.SUBMITTED, hash: "Hash1", tag: "Tag1", process: "Process1")

        and: 'extract its workflow'
        Workflow workflow = firstTask.workflow

        and: 'generate more tasks associated with the workflow'
        [TaskStatus.RUNNING, TaskStatus.FAILED, TaskStatus.COMPLETED].eachWithIndex { status, i ->
            Integer taskId = 2 + i
            new DomainCreator().createTask(workflow: workflow, status: status, taskId: taskId, hash: "Hash${taskId}", tag: "Tag${taskId}", process: "Process${taskId}")
        }

        when: 'search for the tasks associated with the workflow'
        PagedResultList<Task> obtainedTasks = taskService.findTasks(workflow.id, 10, 0, 'taskId', 'asc', search)

        then: 'the obtained tasks are as expected'
        obtainedTasks.taskId == expectedTaskIds

        where: 'the search params are'
        search      | expectedTaskIds
        'hash%'     | [1l, 2l, 3l, 4l]
        'tag%'      | [1l, 2l, 3l, 4l]
        'process%'  | [1l, 2l, 3l, 4l]
        '%a%'       | [1l, 2l, 3l, 4l]

        'hash1'     | [1l]
        'HASH1'     | [1l]
        'process2'  | [2l]
        'PROCESS2'  | [2l]
        'tag3'      | [3l]
        'TAG3'      | [3l]

        'submit%'   | [1l]
        'SUBMITTED' | [1l]
        'submitted' | [1l]
        'run%'      | [2l]
        'fail%'     | [3l]
        'comp%'     | [4l]
    }

    @Unroll
    void "try to find some tasks for a nonexistent workflow"() {
        when: 'search for the tasks associated with a nonexistent workflow'
        PagedResultList<Task> obtainedTasks = taskService.findTasks('100', 10l, 0l, 'taskId', 'asc', null)

        then: 'there are no tasks'
        obtainedTasks.totalCount == 0
        obtainedTasks.size() == 0
    }

}
