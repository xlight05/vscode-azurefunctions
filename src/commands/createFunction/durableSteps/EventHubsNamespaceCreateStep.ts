/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep } from '@microsoft/vscode-azext-utils';
import { IEventHubsConnectionWizardContext } from '../../appSettings/IEventHubsConnectionWizardContext';

export class EventHubsNamespaceCreateStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 200;

    public async execute(_context: T): Promise<void> {
        //
    }

    public shouldExecute(context: T): boolean {
        return !context.eventHubsNamespace
    }
}
