/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, IActionContext, IAzureQuickPickItem, nonNullProp } from "@microsoft/vscode-azext-utils";
import * as path from "path";
import { Uri } from "vscode";
import * as xml2js from "xml2js";
import { EventHubsConnectionExecuteStep } from "../commands/appSettings/EventHubsConnectionExecuteStep";
import { EventHubsConnectionPromptStep } from "../commands/appSettings/EventHubsConnectionPromptStep";
import { IValidateConnectionOptions } from "../commands/appSettings/IConnectionPrompOptions";
import { IEventHubsConnectionWizardContext } from "../commands/appSettings/IEventHubsConnectionWizardContext";
import { NetheriteConfigureHostStep } from "../commands/createFunction/durableSteps/netherite/NetheriteConfigureHostStep";
import { NetheriteEventHubNameStep } from "../commands/createFunction/durableSteps/netherite/NetheriteEventHubNameStep";
import { NetheriteEventHubPartitionsStep } from "../commands/createFunction/durableSteps/netherite/NetheriteEventHubPartitionsStep";
import { IFunctionWizardContext } from "../commands/createFunction/IFunctionWizardContext";
import { ConnectionKey, DurableBackend, DurableBackendValues, emptyWorkspace, hostFileName, localEventHubsEmulatorConnectionString, ProjectLanguage } from "../constants";
import { IHostJsonV2, INetheriteTaskJson, ISqlTaskJson, IStorageTaskJson } from "../funcConfig/host";
import { getLocalConnectionString } from "../funcConfig/local.settings";
import { localize } from "../localize";
import { findFiles, getWorkspaceRootPath } from "./workspace";

export namespace durableUtils {
    export function requiresDurableStorage(templateId: string): boolean {
        const durableOrchestrator: RegExp = /DurableFunctionsOrchestrat/i;  // Sometimes ends with 'or' or 'ion'
        return durableOrchestrator.test(templateId);
    }

    export async function promptForStorageType(context: IFunctionWizardContext): Promise<DurableBackendValues> {
        const durableStorageOptions: string[] = [
            'Durable Functions Orchestration using Storage',
            'Durable Functions Orchestration using Netherite',
            'Durable Functions Orchestration using SQL'
        ];

        const placeHolder: string = localize('chooseDurableStorageType', 'Choose a durable storage type.');
        const picks: IAzureQuickPickItem<DurableBackendValues>[] = [
            { label: durableStorageOptions[0], data: DurableBackend.Storage },
            { label: durableStorageOptions[1], data: DurableBackend.Netherite },
            { label: durableStorageOptions[2], data: DurableBackend.SQL }
        ];
        return (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    export async function getStorageTypeFromWorkspace(language: string | undefined, projectPath?: string): Promise<DurableBackendValues | undefined> {
        projectPath ??= getWorkspaceRootPath();

        if (!projectPath) {
            return;
        }

        const hasDurableStorage: boolean = await verifyHasDurableStorage(language, projectPath);
        if (!hasDurableStorage) {
            return;
        }

        try {
            const hostJsonPath = path.join(projectPath, hostFileName);
            const hostJson: IHostJsonV2 = await AzExtFsExtra.readJSON(hostJsonPath);
            const hostStorageType: DurableBackendValues | undefined = hostJson.extensions?.durableTask?.storageProvider?.type;

            switch (hostStorageType) {
                case DurableBackend.Netherite:
                    return DurableBackend.Netherite;
                case DurableBackend.SQL:
                    return DurableBackend.SQL;
                case DurableBackend.Storage:
                default:
                    // New DF's will use the more specific type 'DurableBackend.Storage', but legacy implementations may return this value as 'undefined'
                    return DurableBackend.Storage;
            }
        } catch {
            return;
        }
    }

    // !------ Verify Durable Storage/Dependencies ------
    // Use workspace dependencies as an indicator to check whether this project already has durable storage setup
    export async function verifyHasDurableStorage(language: string | undefined, projectPath?: string): Promise<boolean> {
        projectPath ??= getWorkspaceRootPath();

        if (!projectPath) {
            return false;
        }

        switch (language) {
            case ProjectLanguage.JavaScript:
            case ProjectLanguage.TypeScript:
                return await nodeProjectHasDurableDependency(projectPath);
            case ProjectLanguage.CSharp:
            case ProjectLanguage.FSharp:
                return await dotnetProjectHasDurableDependency(projectPath);
            case ProjectLanguage.PowerShell:
                // ???
                return false;
            case ProjectLanguage.Python:
            default:
                return false;
        }
    }

    async function nodeProjectHasDurableDependency(projectPath: string): Promise<boolean> {
        try {
            const dfPackageName: string = 'durable-functions';
            const packagePath: string = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await AzExtFsExtra.readFile(packagePath));
            const dependencies = packageJson.dependencies || {};
            return !!nonNullProp(dependencies, dfPackageName);
        } catch {
            return false;
        }
    }

    async function dotnetProjectHasDurableDependency(projectPath: string): Promise<boolean> {
        const dfPackageName: string = 'Microsoft.Azure.WebJobs.Extensions.DurableTask';
        const csProjPaths: Uri[] = await findFiles(projectPath, '*.csproj');
        const csProjContents: string = await AzExtFsExtra.readFile(csProjPaths[0].path);

        return new Promise((resolve) => {
            xml2js.parseString(csProjContents, { explicitArray: false }, (err: any, result: any): void => {
                try {
                    if (result && !err) {
                        if (result && result['Project'] && result['Project']['ItemGroup']?.length) {
                            const packageReferences = result['Project']['ItemGroup'][0]?.PackageReference ?? [];
                            for (const packageRef of packageReferences) {
                                if (packageRef['$'] && packageRef['$']['Include']) {
                                    if (packageRef['$']['Include'] === dfPackageName) {
                                        resolve(true);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                    resolve(false);
                } catch {
                    resolve(false);
                }
            });
        });
    }

    export function getDefaultStorageTaskConfig(): IStorageTaskJson {
        return {
            storageProvider: {
                type: DurableBackend.Storage,
            }
        };
    }
}

export namespace netheriteUtils {
    export async function getEventHubName(projectPath: string): Promise<string | undefined> {
        try {
            const hostJsonPath = path.join(projectPath, hostFileName);
            const hostJson: IHostJsonV2 = await AzExtFsExtra.readJSON(hostJsonPath);
            const taskJson: INetheriteTaskJson = hostJson.extensions?.durableTask as INetheriteTaskJson;
            return taskJson?.hubName;
        } catch {
            return;
        }
    }

    export async function getPartitionCount(projectPath: string): Promise<number | undefined> {
        try {
            const hostJsonPath = path.join(projectPath, hostFileName);
            const hostJson: IHostJsonV2 = await AzExtFsExtra.readJSON(hostJsonPath);
            const taskJson: INetheriteTaskJson = hostJson.extensions?.durableTask as INetheriteTaskJson;
            return taskJson?.storageProvider?.partitionCount;
        } catch {
            return;
        }
    }

    export async function validateConnection(context: IActionContext, options?: Omit<IValidateConnectionOptions, 'suppressSkipForNow'>, projectPath?: string): Promise<void> {
        projectPath ??= getWorkspaceRootPath();

        if (!projectPath) {
            throw new Error(emptyWorkspace);
        }

        const eventHubsConnection: string | undefined = await getLocalConnectionString(context, ConnectionKey.EventHub, projectPath);
        const hasEventHubsConnection: boolean = !!eventHubsConnection && eventHubsConnection !== localEventHubsEmulatorConnectionString;

        const eventHubName: string | undefined = await getEventHubName(projectPath);
        const partitionCount: number | undefined = await getPartitionCount(projectPath);

        const wizardContext: IEventHubsConnectionWizardContext = { ...context, projectPath };
        const promptSteps: AzureWizardPromptStep<IEventHubsConnectionWizardContext>[] = [];
        const executeSteps: AzureWizardExecuteStep<IEventHubsConnectionWizardContext>[] = [];

        if (!hasEventHubsConnection) {
            promptSteps.push(new EventHubsConnectionPromptStep({ preSelectedConnectionType: options?.preSelectedConnectionType, suppressSkipForNow: true }));
            executeSteps.push(new EventHubsConnectionExecuteStep(options?.saveConnectionAsEnvVariable));
        }
        if (!eventHubName) {
            promptSteps.push(new NetheriteEventHubNameStep());
        }
        if (!partitionCount) {
            promptSteps.push(new NetheriteEventHubPartitionsStep());
        }

        executeSteps.push(new NetheriteConfigureHostStep());

        const wizard: AzureWizard<IEventHubsConnectionWizardContext> = new AzureWizard(wizardContext, {
            promptSteps,
            executeSteps
        });

        await wizard.prompt();
        await wizard.execute();
    }

    export function getDefaultNetheriteTaskConfig(hubName?: string, partitionCount?: number): INetheriteTaskJson {
        return {
            hubName: hubName || "",
            useGracefulShutdown: true,
            storageProvider: {
                type: DurableBackend.Netherite,
                partitionCount,
                StorageConnectionName: ConnectionKey.Storage,
                EventHubsConnectionName: ConnectionKey.EventHub,
            }
        };
    }
}

export namespace sqlUtils {
    export function getDefaultSqlTaskConfig(): ISqlTaskJson {
        return {
            storageProvider: {
                type: DurableBackend.SQL,
                connectionStringName: ConnectionKey.SQL,
                taskEventLockTimeout: "00:02:00",
                createDatabaseIfNotExists: true,
                schemaName: null
            }
        };
    }
}
