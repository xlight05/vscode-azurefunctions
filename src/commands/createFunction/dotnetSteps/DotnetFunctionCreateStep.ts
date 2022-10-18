/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { DurableBackend } from '../../../constants';
import { ext } from '../../../extensionVariables';
import { FuncVersion } from '../../../FuncVersion';
import { localize } from '../../../localize';
import { executeDotnetTemplateCommand, validateDotnetInstalled } from '../../../templates/dotnet/executeDotnetTemplateCommand';
import { IFunctionTemplate } from '../../../templates/IFunctionTemplate';
import { cpUtils } from '../../../utils/cpUtils';
import { nonNullProp } from '../../../utils/nonNull';
import { FunctionCreateStepBase } from '../FunctionCreateStepBase';
import { getBindingSetting } from '../IFunctionWizardContext';
import { getFileExtension, IDotnetFunctionWizardContext } from './IDotnetFunctionWizardContext';

export class DotnetFunctionCreateStep extends FunctionCreateStepBase<IDotnetFunctionWizardContext> {
    private constructor() {
        super();
    }

    public static async createStep(context: IActionContext): Promise<DotnetFunctionCreateStep> {
        await validateDotnetInstalled(context);
        return new DotnetFunctionCreateStep();
    }

    public async executeCore(context: IDotnetFunctionWizardContext): Promise<string> {
        const template: IFunctionTemplate = nonNullProp(context, 'functionTemplate');

        const functionName: string = nonNullProp(context, 'functionName');
        const args: string[] = [];
        args.push('--arg:name');
        args.push(cpUtils.wrapArgInQuotes(functionName));

        args.push('--arg:namespace');
        args.push(cpUtils.wrapArgInQuotes(nonNullProp(context, 'namespace')));

        for (const setting of template.userPromptedSettings) {
            const value = getBindingSetting(context, setting);
            // NOTE: Explicitly checking against undefined. Empty string is a valid value
            if (value !== undefined) {
                args.push(`--arg:${setting.name}`);
                args.push(cpUtils.wrapArgInQuotes(value));
            }
        }

        const version: FuncVersion = nonNullProp(context, 'version');
        let projectTemplateKey = context.projectTemplateKey;
        if (!projectTemplateKey) {
            const templateProvider = ext.templateProvider.get(context);
            projectTemplateKey = await templateProvider.getProjectTemplateKey(context, context.projectPath, nonNullProp(context, 'language'), undefined, context.version, undefined);
        }
        await executeDotnetTemplateCommand(context, version, projectTemplateKey, context.projectPath, 'create', '--identity', template.id, ...args);

        await this._installDependenciesIfNeeded(context);

        return path.join(context.projectPath, functionName + getFileExtension(context));
    }

    private async _installDependenciesIfNeeded(context: IDotnetFunctionWizardContext): Promise<void> {
        try {
            // Install Durable Functions dependency
            if (context.newDurableStorageType) {
                switch (context.newDurableStorageType) {
                    case DurableBackend.Netherite:
                        // Todo: verify how this should be installed
                        await cpUtils.executeCommand(ext.outputChannel, context.projectPath, 'dotnet', 'add', 'package', 'Microsoft.Azure.DurableTask.Netherite.AzureFunctions');
                        break;
                    case DurableBackend.SQL:
                        break;
                    case DurableBackend.Storage:
                    default:
                }

                await cpUtils.executeCommand(ext.outputChannel, context.projectPath, 'dotnet', 'add', 'package', 'Microsoft.Azure.WebJobs.Extensions.DurableTask');  // Seems that the package arrives out-dated and needs to be updated
            }
        } catch {
            ext.outputChannel.appendLog(localize('funcInstallFailed', 'WARNING: Failed to install and update Durable Functions NuGet packages to the .csproj project file. You may need to configure them manually or start from a clean project.'))
        }
    }
}
