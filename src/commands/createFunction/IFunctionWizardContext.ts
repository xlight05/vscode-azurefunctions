/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { DurableBackend } from "../../constants";
import { BindingSettingValue } from "../../funcConfig/function";
import { IBindingSetting } from "../../templates/IBindingTemplate";
import { IFunctionTemplate } from "../../templates/IFunctionTemplate";
import { IProjectWizardContext } from "../createNewProject/IProjectWizardContext";

export interface IFunctionWizardContext extends Partial<ISubscriptionContext>, IProjectWizardContext {
    functionTemplate?: IFunctionTemplate;
    functionName?: string;

    // Durable Functions
    hasDurableOrchestrator?: boolean;  // Existing project already has a durable orchestrator
    durableStorageType?: keyof typeof DurableBackend;  // Only defined for projects that do not yet have a durable orchestrator
}

export function setBindingSetting(context: IFunctionWizardContext, setting: IBindingSetting, value: BindingSettingValue): void {
    context[setting.name.toLowerCase()] = value;
}

export function getBindingSetting(context: IFunctionWizardContext, setting: IBindingSetting): BindingSettingValue {
    const value = <BindingSettingValue>context[setting.name.toLowerCase()];
    return value === undefined && setting.required ? '' : value;
}
