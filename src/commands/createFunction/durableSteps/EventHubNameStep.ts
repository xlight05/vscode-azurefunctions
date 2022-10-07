/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { IEventHubsConnectionWizardContext } from '../../appSettings/IEventHubsConnectionWizardContext';

export class EventHubNameStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        context.newEventHubName = 'gibberishEventHubName';
    }

    public shouldPrompt(context: T): boolean {
        return !context.newEventHubName;
    }
}
