/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, nonNullProp } from "@microsoft/vscode-azext-utils";
import * as path from "path";
import { DurableBackend, durableStorageTemplateNames, hostFileName, ProjectLanguage } from "../constants";
import { IHostJsonV2, INetheriteTaskJson, ISqlTaskJson, IStorageTaskJson } from "../funcConfig/host";
import { azureWebJobsStorageKey, eventHubsConnectionKey } from "../funcConfig/local.settings";

export namespace durableUtils {
    // !------ Get Storage Type From... ------
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

    export function getStorageTypeFromTemplateName(templateName: string): typeof DurableBackend[keyof typeof DurableBackend] | undefined {
        switch (templateName) {
            case durableStorageTemplateNames[0]:
                return DurableBackend.Storage;
            case durableStorageTemplateNames[1]:
                return DurableBackend.Netherite;
            case durableStorageTemplateNames[2]:
                return DurableBackend.SQL;
            default:
                return undefined;
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
