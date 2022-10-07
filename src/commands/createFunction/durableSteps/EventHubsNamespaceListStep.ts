/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EHNamespace, EventHubManagementClient } from '@azure/arm-eventhub';
import { LocationListStep, ResourceGroupListStep, uiUtils } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardPromptStep, IAzureQuickPickItem, IAzureQuickPickOptions, ISubscriptionActionContext, IWizardOptions, nonNullProp } from '@microsoft/vscode-azext-utils';
import { localize } from '../../../localize';
import { createEventHubClient } from '../../../utils/azureClients';
import { IEventHubsConnectionWizardContext } from '../../appSettings/IEventHubsConnectionWizardContext';
import { EventHubsNamespaceCreateStep } from './EventHubsNamespaceCreateStep';
import { EventHubsNamespaceNameStep } from './EventHubsNamespaceNameStep';

export class EventHubsNamespaceListStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public static async isNameAvailable<T extends IEventHubsConnectionWizardContext & ISubscriptionActionContext>(context: T, name: string): Promise<boolean> {
        const client: EventHubManagementClient = await createEventHubClient(context);
        return !!(await client.namespaces.checkNameAvailability({ name })).nameAvailable;
    }

    public async prompt(context: T): Promise<void> {
        const client: EventHubManagementClient = await createEventHubClient(<ISubscriptionActionContext>context);

        const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select an event hub namespace.', id: `EventHubNamespaceListStep/${context.subscriptionId}` };
        const picksTask: Promise<IAzureQuickPickItem<EHNamespace | undefined>[]> = this.getQuickPicks(uiUtils.listAllIterator(client.namespaces.list()));

        const result: EHNamespace | undefined = (await context.ui.showQuickPick(picksTask, quickPickOptions)).data;
        context.eventHubsNamespace = result;
    }

    public async getSubWizard(context: T): Promise<IWizardOptions<T> | undefined> {
        if (!context.eventHubsNamespace) {
            const promptSteps: AzureWizardPromptStep<T & ISubscriptionActionContext>[] = [
                new EventHubsNamespaceNameStep(),
                new ResourceGroupListStep()
            ];
            LocationListStep.addStep(context, promptSteps);
            return {
                promptSteps: promptSteps,
                executeSteps: [
                    new EventHubsNamespaceCreateStep()
                ]
            };
        } else {
            context.valuesToMask.push(nonNullProp(context.eventHubsNamespace, 'name'));
            return undefined;
        }
    }

    public shouldPrompt(context: T): boolean {
        return !context.eventHubsNamespace;
    }

    private async getQuickPicks(namespaceTask: Promise<EHNamespace[]>): Promise<IAzureQuickPickItem<EHNamespace | undefined>[]> {
        const picks: IAzureQuickPickItem<EHNamespace | undefined>[] = [{
            label: localize('newEventHubsNamespace', '$(plus) Create new event hub namespace'),
            description: '',
            data: undefined
        }];

        const eventHubNamespaces: EHNamespace[] = await namespaceTask;
        for (const namespace of eventHubNamespaces) {
            picks.push({
                id: namespace.id,
                label: namespace.name!,
                description: '',
                data: namespace
            });
        }

        return picks;
    }
}
