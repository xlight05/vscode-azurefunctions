/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, IAzureQuickPickItem, nonNullProp } from "@microsoft/vscode-azext-utils";
import * as path from "path";
import { IFunctionWizardContext } from "../commands/createFunction/IFunctionWizardContext";
import { ConnectionKey, DurableBackend, DurableBackendValues, hostFileName, ProjectLanguage } from "../constants";
import { IHostJsonV2, INetheriteTaskJson, ISqlTaskJson, IStorageTaskJson } from "../funcConfig/host";
import { localize } from "../localize";
import { getWorkspaceRootPath } from "./workspace";

export namespace durableUtils {
    export function requiresDurableStorage(templateId: string): boolean {
        const durableOrchestrator: RegExp = /\bDurableFunctionsOrchestrator/i;
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
            case ProjectLanguage.CSharpScript:
            case ProjectLanguage.FSharpScript:
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

    // !----- Get Netherite Config Params From host.json -----
    export async function getNetheriteEventHubName(projectPath: string): Promise<string | undefined> {
        try {
            const hostJsonPath = path.join(projectPath, hostFileName);
            const hostJson: IHostJsonV2 = await AzExtFsExtra.readJSON(hostJsonPath);
            const taskJson: INetheriteTaskJson = hostJson.extensions?.durableTask as INetheriteTaskJson;
            return taskJson?.hubName;
        } catch {
            return;
        }
    }

    export async function getNetheritePartitionCount(projectPath: string): Promise<number | undefined> {
        try {
            const hostJsonPath = path.join(projectPath, hostFileName);
            const hostJson: IHostJsonV2 = await AzExtFsExtra.readJSON(hostJsonPath);
            const taskJson: INetheriteTaskJson = hostJson.extensions?.durableTask as INetheriteTaskJson;
            return taskJson?.storageProvider?.partitionCount;
        } catch {
            return;
        }
    }

    // !----- Default Host Durable Task Configs -----
    export function getDefaultStorageTaskConfig(): IStorageTaskJson {
        return {
            storageProvider: {
                type: DurableBackend.Storage,
            }
        };
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
