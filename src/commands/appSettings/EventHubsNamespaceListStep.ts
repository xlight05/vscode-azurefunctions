/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EHNamespace } from '@azure/arm-eventhub';
import { AzExtLocation, LocationListStep, uiUtils } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardPromptStep, IAzureQuickPickItem, IAzureQuickPickOptions, ISubscriptionActionContext } from '@microsoft/vscode-azext-utils';
import { localize } from '../../localize';
import { createEventHubClient } from '../../utils/azureClients';
import { IEventHubsConnectionWizardContext } from './IEventHubsConnectionWizardContext';

export class EventHubsNamespaceListStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public constructor() {
        super();
    }

    // public static async isNameAvailable<T extends types.IStorageAccountcontext>(context: T, name: string): Promise<boolean> {
    //     const storageClient: StorageManagementClient = await createStorageClient(context);
    //     return !!(await storageClient.storageAccounts.checkNameAvailability({ name, type: storageProviderType })).nameAvailable;
    // }

    public async prompt(context: T): Promise<void> {
        const client = await createEventHubClient(<ISubscriptionActionContext>context);

        const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select an event hub namespace.', id: `EventHubNamespaceListStep/${context.subscriptionId}` };
        const picksTask: Promise<IAzureQuickPickItem<EHNamespace | undefined>[]> = this.getQuickPicks(<ISubscriptionActionContext>context, uiUtils.listAllIterator(client.namespaces.list()));

        const result: EHNamespace | undefined = (await context.ui.showQuickPick(picksTask, quickPickOptions)).data;
        context.eventHubsNamespace = result;
    }

    public async getSubWizard(context: T): Promise<IWizardOptions<T> | undefined> {
        if (!context.storageAccount) {
            const promptSteps: AzureWizardPromptStep<T>[] = [new StorageAccountNameStep(), new ResourceGroupListStep()];
            LocationListStep.addStep(context, promptSteps);
            return {
                promptSteps: promptSteps,
                executeSteps: [new StorageAccountCreateStep(this._newAccountDefaults)]
            };
        } else {
            context.valuesToMask.push(nonNullProp(context.storageAccount, 'name'));
            return undefined;
        }
    }

    public shouldPrompt(context: T): boolean {
        return !context.eventHubsNamespace;
    }

    private async getQuickPicks(context: ISubscriptionActionContext, namespaceTask: Promise<EHNamespace[]>): Promise<IAzureQuickPickItem<EHNamespace | undefined>[]> {
        const picks: IAzureQuickPickItem<EHNamespace | undefined>[] = [{
            label: localize('newEventHubsNamespace', '$(plus) Create new event hub namespace'),
            description: '',
            data: undefined
        }];

        let location: AzExtLocation | undefined;
        if (LocationListStep.hasLocation(context)) {
            location = await LocationListStep.getLocation(context);
        }

        let hasFilteredAccountsBySku: boolean = false;
        let hasFilteredAccountsByLocation: boolean = false;
        const eventHubNamespaces: EHNamespace[] = await namespaceTask;
        for (const ehn of eventHubNamespaces) {
            if (!ehn.kind || ehn.kind.match(kindRegExp) || !ehn.sku || ehn.sku.name.match(performanceRegExp) || ehn.sku.name.match(replicationRegExp)) {
                hasFilteredAccountsBySku = true;
                continue;
            }

            if (location && !LocationListStep.locationMatchesName(location, ehn.location)) {
                hasFilteredAccountsByLocation = true;
                continue;
            }

            picks.push({
                id: ehn.id,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                label: ehn.name!,
                description: '',
                data: ehn
            });
        }

        if (hasFilteredAccountsBySku && this._filters.learnMoreLink) {
            picks.push({
                label: localize('hasFilteredAccountsBySku', '$(info) Some storage accounts were filtered because of their sku. Learn more...'),
                onPicked: async () => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    await openUrl(this._filters.learnMoreLink!);
                },
                data: undefined
            });
        }

        if (hasFilteredAccountsByLocation && location) {
            picks.push({
                label: localize('hasFilteredAccountsByLocation', '$(warning) Only storage accounts in the region "{0}" are shown.', location.displayName),
                onPicked: () => { /* do nothing */ },
                data: undefined
            });
        }

        return picks;
    }
}

    public shouldPrompt(_context: T): boolean {
    return true;
}
}
