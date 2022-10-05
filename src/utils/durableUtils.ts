/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, nonNullProp } from "@microsoft/vscode-azext-utils";
import * as path from "path";
import { DurableBackend, durableStorageTemplateNames, hostFileName, ProjectLanguage } from "../constants";
import { IHostJsonV2 } from "../funcConfig/host";

export namespace durableUtils {
    // !------ Get Storage Type From... ------
    export async function getStorageTypeFromWorkspace(language: string, projectPath: string): Promise<typeof DurableBackend[keyof typeof DurableBackend] | undefined> {
        const hasDurableOrchestrator: boolean = await verifyHasDurableOrchestrator(language, projectPath);

        if (!hasDurableOrchestrator) {
            return;
        }

        const hostJsonPath = path.join(projectPath, hostFileName);
        const hostJson: IHostJsonV2 = await AzExtFsExtra.readJSON(hostJsonPath);
        const hostStorageType: string | undefined = hostJson.extensions?.durableTask?.type;

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

    export function getStorageTypeFromName(templateName: string): typeof DurableBackend[keyof typeof DurableBackend] | undefined {
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

    // !------ Verify Durable Orchestrator/Dependencies ------
    // Use workspace dependencies as an indicator to check whether this project already has a durable orchestrator
    export async function verifyHasDurableOrchestrator(language: string, projectPath: string): Promise<boolean> {
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
    export function getDefaultStorageTaskConfig() {
        return {
            durableTask: {
                storageProvider: {
                    type: "AzureStorage",
                }
            }
        };
    }

    export function getDefaultNetheriteTaskConfig(partitionCount?: number) {
        return {
            durableTask: {
                hubName: "NetheriteHub",
                useGracefulShutdown: true,
                storageProvider: {
                    type: "Netherite",
                    partitionCount: partitionCount || 12,
                    StorageConnectionName: "AzureWebJobsStorage",
                    EventHubsConnectionName: "EventHubsConnection",
                }
            }
        };
    }

    export function getDefaultSqlTaskConfig() {
        return {
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
    }

    // !----- Default Local Settings Value (LSV) Configs -----
    export function getDefaultNetheriteLsvConfig() {
        return { EventHubsConnection: "" };
    }

    export function getDefaultSqlLsvConfig() {
        return { SQLDB_Connection: "" };
    }
}
