/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventHubManagementClient } from '@azure/arm-eventhub';
import { AzureWizardPromptStep, ISubscriptionActionContext } from '@microsoft/vscode-azext-utils';
import { localize } from '../../../localize';
import { createEventHubClient } from '../../../utils/azureClients';
import { IEventHubsConnectionWizardContext } from '../../appSettings/IEventHubsConnectionWizardContext';

export class EventHubNameStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        context.newEventHubName = (await context.ui.showInputBox({
            prompt: localize('eventHubNamePrompt', 'Enter a name for the new event hub.'),
            validateInput: async (value: string | undefined): Promise<string | undefined> => await this.validateInput(<T & ISubscriptionActionContext>context, value)
        })).trim();
    }

    public shouldPrompt(context: T): boolean {
        return !context.newEventHubName && !!context.resourceGroup?.name && !!context.eventHubsNamespace?.name;
    }

    private async isNameAvailable(context: T & ISubscriptionActionContext, name: string): Promise<boolean> {
        const client: EventHubManagementClient = await createEventHubClient(context);
        return !(await client.eventHubs.get(context.resourceGroup!.name!, context.eventHubsNamespace!.name!, name));
    }

    private async validateInput(context: T & ISubscriptionActionContext, name: string | undefined): Promise<string | undefined> {
        name = name ? name.trim() : '';

        if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
            return localize('invalidChar', `A name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character.`);
        }

        const isAvailable: boolean = await this.isNameAvailable(context, name);
        if (!isAvailable) {
            return localize('eventHubExists', 'The event hub "{0}" already exists. Please enter a unique name.', name);
        }
        return undefined;
    }
}
