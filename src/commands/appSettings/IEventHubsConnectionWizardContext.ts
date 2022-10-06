/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EHNamespace } from "@azure/arm-eventhub";
import { IActionContext, ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { ConnectionType } from "../../constants";

export interface IEventHubsConnectionWizardContext extends IActionContext, Partial<ISubscriptionContext> {
    projectPath: string;
    eventHubConnectionType?: typeof ConnectionType[keyof typeof ConnectionType];
    eventHubsNamespace?: EHNamespace;
}
