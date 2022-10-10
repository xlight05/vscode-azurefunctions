/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { ConnectionType } from '../../../../constants';
import { localize } from '../../../../localize';
import { IEventHubsConnectionWizardContext } from '../../../appSettings/IEventHubsConnectionWizardContext';

export class NetheriteEventHubNameStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        context.newEventHubName = (await context.ui.showInputBox({
            prompt: localize('eventHubNamePrompt', 'Enter a name for the new event hub.'),
            validateInput: async (value: string | undefined): Promise<string | undefined> => await this.validateInput(value)
        })).trim();
    }

    public shouldPrompt(context: T): boolean {
        return !context.newEventHubName && context.eventHubConnectionType !== ConnectionType.Skip;
    }

    private async validateInput(name: string | undefined): Promise<string | undefined> {
        name = name ? name.trim() : '';

        // Todo:  validateInput regexp + add localize string to constants if needed
        if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
            return localize('invalidChar', `A name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character.`);
        }

        return undefined;
    }
}
