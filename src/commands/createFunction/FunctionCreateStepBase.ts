/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, AzureWizardExecuteStep, callWithTelemetryAndErrorHandling, IActionContext } from '@microsoft/vscode-azext-utils';
import { Progress, Uri, window, workspace } from 'vscode';
import { DurableBackend, hostFileName, localSettingsFileName } from '../../constants';
import { ext } from '../../extensionVariables';
import { IHostJsonV2 } from '../../funcConfig/host';
import { ILocalSettingsJson } from '../../funcConfig/local.settings';
import { localize } from '../../localize';
import { IFunctionTemplate } from '../../templates/IFunctionTemplate';
import { nonNullProp } from '../../utils/nonNull';
import { verifyExtensionBundle } from '../../utils/verifyExtensionBundle';
import { getContainingWorkspace } from '../../utils/workspace';
import { IFunctionWizardContext } from './IFunctionWizardContext';
import path = require('path');

interface ICachedFunction {
    projectPath: string;
    newFilePath: string;
    isHttpTrigger: boolean;
}

const cacheKey: string = 'azFuncPostFunctionCreate';

export async function runPostFunctionCreateStepsFromCache(): Promise<void> {
    const cachedFunc: ICachedFunction | undefined = ext.context.globalState.get(cacheKey);
    if (cachedFunc) {
        try {
            runPostFunctionCreateSteps(cachedFunc);
        } finally {
            await ext.context.globalState.update(cacheKey, undefined);
        }
    }
}

export abstract class FunctionCreateStepBase<T extends IFunctionWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 220;

    /**
     * Returns the full path to the new function file
     */
    public abstract executeCore(context: T): Promise<string>;

    public async execute(context: T, progress: Progress<{ message?: string | undefined; increment?: number | undefined }>): Promise<void> {
        const template: IFunctionTemplate = nonNullProp(context, 'functionTemplate');

        context.telemetry.properties.projectLanguage = context.language;
        context.telemetry.properties.projectRuntime = context.version;
        context.telemetry.properties.templateId = template.id;

        progress.report({ message: localize('creatingFunction', 'Creating new {0}...', template.name) });

        const newFilePath: string = await this.executeCore(context);
        await this._configureDurableStorageIfNeeded(context);
        await verifyExtensionBundle(context, template);

        const cachedFunc: ICachedFunction = { projectPath: context.projectPath, newFilePath, isHttpTrigger: template.isHttpTrigger };

        if (context.openBehavior) {
            // OpenFolderStep sometimes restarts the extension host, so we will cache this to run on the next extension activation
            await ext.context.globalState.update(cacheKey, cachedFunc);
            // Delete cached information if the extension host was not restarted after 5 seconds
            setTimeout(() => { void ext.context.globalState.update(cacheKey, undefined); }, 5 * 1000);
        }

        runPostFunctionCreateSteps(cachedFunc);
    }

    public shouldExecute(context: T): boolean {
        return !!context.functionTemplate;
    }

    private async _configureDurableStorageIfNeeded(context: T): Promise<void> {
        if (!context.durableStorageType || context.durableStorageType === DurableBackend.Storage) {
            return;
        }

        try {
            const hostJsonPath: string = path.join(context.projectPath, hostFileName);
            const hostJson: IHostJsonV2 = await AzExtFsExtra.readJSON(hostJsonPath) as IHostJsonV2;
            const localSettingsPath: string = path.join(context.projectPath, localSettingsFileName);
            const localSettingsJson: ILocalSettingsJson = await AzExtFsExtra.readJSON(localSettingsPath) as ILocalSettingsJson;

            if (context.durableStorageType === DurableBackend.Netherite) {
                hostJson.extensions = {
                    durableTask: {
                        hubName: "NetheriteHub",
                        useGracefulShutdown: true,
                        storageProvider: {
                            type: "Netherite",
                            partitionCount: 12,
                            StorageConnectionName: "AzureWebJobsStorage",
                            EventHubsConnectionName: "EventHubsConnection",
                        }
                    }
                };
                localSettingsJson.Values = { ...localSettingsJson.Values, EventHubsConnection: "" };
            } else if (context.durableStorageType === DurableBackend.SQL) {
                hostJson.extensions = {
                    durableTask: {
                        storageProvider: {
                            type: "mssql",
                            connectionStringName: "SQLDB_Connection",
                            taskEventLockTimeout: "00:02:00",
                            createDatabaseIfNotExists: true,
                            schemaName: null
                        }
                    }
                };
                localSettingsJson.Values = { ...localSettingsJson.Values, SQLDB_Connection: "" };
            }

            await AzExtFsExtra.writeJSON(hostJsonPath, hostJson);
            await AzExtFsExtra.writeJSON(localSettingsPath, localSettingsJson);
        } catch (error) {
            console.log(error);
        }
    }
}

function runPostFunctionCreateSteps(func: ICachedFunction): void {
    // Don't wait
    void callWithTelemetryAndErrorHandling('postFunctionCreate', async (context: IActionContext) => {
        context.telemetry.suppressIfSuccessful = true;

        // If function creation created a new file, open it in an editor...
        if (func.newFilePath && getContainingWorkspace(func.projectPath)) {
            if (await AzExtFsExtra.pathExists(func.newFilePath)) {
                await window.showTextDocument(await workspace.openTextDocument(Uri.file(func.newFilePath)));
            }
        }
    });
}
