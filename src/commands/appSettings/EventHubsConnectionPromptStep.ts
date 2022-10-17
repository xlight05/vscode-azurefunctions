/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, ISubscriptionActionContext, IWizardOptions } from '@microsoft/vscode-azext-utils';
import { MessageItem } from 'vscode';
import { ConnectionType } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize, skipForNow, useEmulator } from '../../localize';
import { EventHubsNamespaceListStep } from '../createFunction/durableSteps/netherite/EventHubsNamespaceListStep';
import { IConnectionPromptOptions } from './IConnectionPrompOptions';
import { IEventHubsConnectionWizardContext } from './IEventHubsConnectionWizardContext';

export class EventHubsConnectionPromptStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public constructor(private readonly _options?: IConnectionPromptOptions) {
        super();
    }

    public async prompt(context: T): Promise<void> {
        if (this._options?.preSelectedConnectionType) {
            context.eventHubConnectionType = this._options.preSelectedConnectionType;
            context.telemetry.properties.eventHubConnectionType = this._options.preSelectedConnectionType;
            return;
        }

        const connectEventNamespaceButton: MessageItem = { title: localize('connectEventHubsNamespace', 'Connect event hub namespace') };
        const useEmulatorButton: MessageItem = { title: useEmulator };
        const skipForNowButton: MessageItem = { title: skipForNow };

        const message: string = localize('selectEventHubsNamespace', 'In order to proceed, you must connect an event hub namespace for internal use by the Azure Functions runtime.');

        const buttons: MessageItem[] = [connectEventNamespaceButton];
        if (process.platform === 'win32') {
            // Only show on Windows until Azurite is officially supported: https://github.com/Azure/azure-functions-core-tools/issues/1247
            buttons.push(useEmulatorButton);
        }
        if (!this._options?.suppressSkipForNow) {
            buttons.push(skipForNowButton);
        }

        const result: MessageItem = await context.ui.showWarningMessage(message, { modal: true }, ...buttons);
        if (result === connectEventNamespaceButton) {
            context.eventHubConnectionType = ConnectionType.Azure;
        } else if (result === useEmulatorButton) {
            context.eventHubConnectionType = ConnectionType.NonAzure;
        } else {
            context.eventHubConnectionType = ConnectionType.None;
        }

        context.telemetry.properties.eventHubConnectionType = context.eventHubConnectionType;
    }

    public shouldPrompt(context: T): boolean {
        if (context.azureWebJobsStorageType) {
            context.eventHubConnectionType = context.azureWebJobsStorageType;
        }
        return !context.eventHubConnectionType;
    }

    public async getSubWizard(context: T): Promise<IWizardOptions<T & ISubscriptionActionContext> | undefined> {
        if (context.eventHubConnectionType === ConnectionType.Azure) {
            const promptSteps: AzureWizardPromptStep<T & ISubscriptionActionContext>[] = [];

            const subscriptionPromptStep: AzureWizardPromptStep<ISubscriptionActionContext> | undefined = await ext.azureAccountTreeItem.getSubscriptionPromptStep(context);
            if (subscriptionPromptStep) {
                promptSteps.push(subscriptionPromptStep);
            }

            promptSteps.push(new EventHubsNamespaceListStep());

            return { promptSteps };
        } else {
            return undefined;
        }
    }
}
