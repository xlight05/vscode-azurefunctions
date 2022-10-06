/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { ConnectionType } from "../../constants";

export interface IAzureWebJobsStorageWizardContext extends IActionContext, Partial<ISubscriptionContext> {
    projectPath: string;
    azureWebJobsStorageType?: typeof ConnectionType[keyof typeof ConnectionType];
}
