/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, IAzureQuickPickItem, nonNullProp } from "@microsoft/vscode-azext-utils";
import * as path from "path";
import { IFunctionWizardContext } from "../commands/createFunction/IFunctionWizardContext";
import { DurableBackend, hostFileName, ProjectLanguage } from "../constants";
import { IHostJsonV2, INetheriteTaskJson, ISqlTaskJson, IStorageTaskJson } from "../funcConfig/host";
import { azureWebJobsStorageKey, eventHubsConnectionKey } from "../funcConfig/local.settings";
import { localize } from "../localize";

export namespace durableUtils {
    export function requiresDurableStorage(templateId: string): boolean {
        const durableOrchestrator: RegExp = /\bDurableFunctionsOrchestrator/i;
        return durableOrchestrator.test(templateId);
    }

    export async function promptForStorageType(context: IFunctionWizardContext): Promise<typeof DurableBackend[keyof typeof DurableBackend]> {
        const durableStorageOptions: string[] = [
            'Durable Functions Orchestration using Storage',
            'Durable Functions Orchestration using Netherite',
            'Durable Functions Orchestration using SQL'
        ];

        const placeHolder: string = localize('chooseDurableStorageType', 'Choose a durable storage type.');
        const picks: IAzureQuickPickItem<typeof DurableBackend[keyof typeof DurableBackend]>[] = [
            { label: durableStorageOptions[0], data: DurableBackend.Storage },
            { label: durableStorageOptions[1], data: DurableBackend.Netherite },
            { label: durableStorageOptions[2], data: DurableBackend.SQL }
        ];
        return (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    export async function getStorageTypeFromWorkspace(language: string, projectPath: string): Promise<typeof DurableBackend[keyof typeof DurableBackend] | undefined> {
        const hasDurableStorage: boolean = await verifyHasDurableStorage(language, projectPath);

        if (!hasDurableStorage) {
            return;
        }

        const hostJsonPath = path.join(projectPath, hostFileName);
        const hostJson: IHostJsonV2 = await AzExtFsExtra.readJSON(hostJsonPath);
        const hostStorageType: typeof DurableBackend[keyof typeof DurableBackend] | undefined = hostJson.extensions?.durableTask?.storageProvider?.type;

        switch (hostStorageType) {
            case DurableBackend.Netherite:
                return DurableBackend.Netherite;
            case DurableBackend.SQL:
                return DurableBackend.SQL;
            // New DF's will use the more specific type 'DurableBackend.Storage', but legacy implementations may return this value as 'undefined'
            case DurableBackend.Storage:
            default:
                return DurableBackend.Storage;
        }
    }

    // !------ Verify Durable Storage/Dependencies ------
    // Use workspace dependencies as an indicator to check whether this project already has durable storage setup
    export async function verifyHasDurableStorage(language: string, projectPath: string): Promise<boolean> {
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
            hubName: hubName || "NetheriteHub",
            useGracefulShutdown: true,
            storageProvider: {
                type: DurableBackend.Netherite,
                partitionCount: partitionCount || 12,
                StorageConnectionName: azureWebJobsStorageKey,
                EventHubsConnectionName: eventHubsConnectionKey,
            }
        };
    }

    export function getDefaultSqlTaskConfig(): ISqlTaskJson {
        return {
            storageProvider: {
                type: DurableBackend.SQL,
                connectionStringName: "SQLDB_Connection",
                taskEventLockTimeout: "00:02:00",
                createDatabaseIfNotExists: true,
                schemaName: null
            }
        };
    }
}
