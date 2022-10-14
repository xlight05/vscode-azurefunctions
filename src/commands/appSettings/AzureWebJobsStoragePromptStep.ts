/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardPromptStep, ISubscriptionActionContext, IWizardOptions } from '@microsoft/vscode-azext-utils';
import { MessageItem } from 'vscode';
import { ConnectionType, ConnectionTypeValues, skipForNow, useEmulator } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { IAzureWebJobsStorageWizardContext } from './IAzureWebJobsStorageWizardContext';
import { IConnectionPromptOptions } from './IConnectionPrompOptions';
export class AzureWebJobsStoragePromptStep<T extends IAzureWebJobsStorageWizardContext> extends AzureWizardPromptStep<T> {
    public constructor(private readonly _options?: IConnectionPromptOptions) {
        super();
    }

    public async prompt(context: T): Promise<void> {
        if (this._options?.preSelectedConnectionType) {
            context.azureWebJobsStorageType = this._options.preSelectedConnectionType;
            context.telemetry.properties.azureWebJobsStorageType = this._options.preSelectedConnectionType;
            return;
        }

        const selectStorageButton: MessageItem = { title: localize('selectStorageAccount', 'Select Storage Account') };
        const useEmulatorButton: MessageItem = { title: useEmulator };
        const skipForNowButton: MessageItem = { title: skipForNow };

        const message: string = localize('selectAzureWebJobsStorage', 'In order to proceed, you must select a storage account for internal use by the Azure Functions runtime.');

        const buttons: MessageItem[] = [selectStorageButton];
        if (process.platform === 'win32') {
            // Only show on Windows until Azurite is officially supported: https://github.com/Azure/azure-functions-core-tools/issues/1247
            buttons.push(useEmulatorButton);
        }
        if (!this._options?.suppressSkipForNow) {
            buttons.push(skipForNowButton);
        }

        const result: MessageItem = await context.ui.showWarningMessage(message, { modal: true }, ...buttons);
        if (result === selectStorageButton) {
            context.azureWebJobsStorageType = ConnectionType.Azure;
        } else if (result === useEmulatorButton) {
            context.azureWebJobsStorageType = ConnectionType.NonAzure;
        } else {
            context.azureWebJobsStorageType = ConnectionType.None;
        }

        context.telemetry.properties.azureWebJobsStorageType = context.azureWebJobsStorageType;
    }

    public shouldPrompt(context: T & { eventHubConnectionType?: ConnectionTypeValues, sqlDbConnectionType?: ConnectionTypeValues }): boolean {
        if (context.eventHubConnectionType) {
            context.azureWebJobsStorageType = context.eventHubConnectionType;
        } else if (context.sqlDbConnectionType) {
            context.azureWebJobsStorageType = context.sqlDbConnectionType;
        }
        return !context.azureWebJobsStorageType;
    }

    public async getSubWizard(context: T): Promise<IWizardOptions<T & ISubscriptionActionContext> | undefined> {
        if (context.azureWebJobsStorageType === ConnectionType.Azure) {
            const promptSteps: AzureWizardPromptStep<T & ISubscriptionActionContext>[] = [];

            const subscriptionPromptStep: AzureWizardPromptStep<ISubscriptionActionContext> | undefined = await ext.azureAccountTreeItem.getSubscriptionPromptStep(context);
            if (subscriptionPromptStep) {
                promptSteps.push(subscriptionPromptStep);
            }

            promptSteps.push(new StorageAccountListStep(
                { // INewStorageAccountDefaults
                    kind: StorageAccountKind.Storage,
                    performance: StorageAccountPerformance.Standard,
                    replication: StorageAccountReplication.LRS
                },
                { // IStorageAccountFilters
                    kind: [StorageAccountKind.BlobStorage],
                    performance: [StorageAccountPerformance.Premium],
                    replication: [StorageAccountReplication.ZRS],
                    learnMoreLink: 'https://aka.ms/Cfqnrc'
                }
            ));

            return { promptSteps };
        } else {
            return undefined;
        }
    }
}
