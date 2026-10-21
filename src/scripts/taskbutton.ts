/** Binds a "run task" button on a plugin settings page to a scheduled task, as window.TaskButton. */
import type { TaskInfo } from '@jellyfin/sdk/lib/generated-client/models/task-info';
import { getScheduledTaskApi } from '@jellyfin/sdk/lib/utils/api/scheduled-task-api';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';

import globalize from 'lib/globalize';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';

import 'elements/formElements';

interface TaskButtonOptions {
    mode?: 'on' | 'off'
    taskKey: string
    button: HTMLButtonElement
    panel?: HTMLElement
    progressElem?: HTMLProgressElement
    lastResultElem?: HTMLElement
}

const RESULT_HTML: Record<string, () => string> = {
    Failed: () => `<span style="color:#FF0000;">(${globalize.translate('LabelFailed')})</span>`,
    Cancelled: () => `<span style="color:#0026FF;">(${globalize.translate('LabelCancelled')})</span>`,
    Aborted: () => `<span style="color:#FF0000;">${globalize.translate('LabelAbortedByServerShutdown')}</span>`
};

/** Per button: how to stop listening, so mode "off" undoes an earlier "on" */
const bound = new WeakMap<HTMLButtonElement, () => void>();

function render(options: TaskButtonOptions, tasks: TaskInfo[]) {
    const task = tasks.find(t => t.Key === options.taskKey);
    options.panel?.classList.toggle('hide', !task);
    if (!task) return;

    options.button.disabled = task.State !== 'Idle';
    options.button.setAttribute('data-taskid', task.Id ?? '');

    if (options.progressElem) {
        options.progressElem.value = Number((task.CurrentProgressPercentage ?? 0).toFixed(1));
        options.progressElem.classList.toggle('hide', task.State !== 'Running');
    }

    if (options.lastResultElem) {
        const status = task.LastExecutionResult?.Status ?? '';
        options.lastResultElem.innerHTML = RESULT_HTML[status]?.() ?? status;
    }
}

export default function taskButton(options: TaskButtonOptions) {
    bound.get(options.button)?.();
    bound.delete(options.button);
    options.panel?.classList.add('hide');
    if (options.mode === 'off') return;

    const api = ServerConnections.getApi(ServerConnections.currentApiClient()?.serverId());
    if (!api) return;

    const onClick = () => {
        const taskId = options.button.getAttribute('data-taskid');
        if (taskId) void getScheduledTaskApi(api).startTask({ taskId });
    };
    options.button.addEventListener('click', onClick);
    const unsubscribe = api.subscribe([ OutboundWebSocketMessageType.ScheduledTasksInfo ], ({ Data }) => render(options, (Data as TaskInfo[] | undefined) ?? []));

    bound.set(options.button, () => {
        options.button.removeEventListener('click', onClick);
        unsubscribe();
    });
}
