/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, nonNullProp } from "@microsoft/vscode-azext-utils";
import * as path from "path";
import { ProjectLanguage } from "../../constants";

// Use workspace dependencies as an indicator that this is a durable functions project
export async function isProjectDurable(language: string, projectPath: string): Promise<boolean> {
    switch (language) {
        case ProjectLanguage.JavaScript:
        case ProjectLanguage.TypeScript:
            return await isNodeProjectDurable(projectPath);
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

async function isNodeProjectDurable(projectPath: string): Promise<boolean> {
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
