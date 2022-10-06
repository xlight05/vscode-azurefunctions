/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, ISubscriptionActionContext, IWizardOptions } from '@microsoft/vscode-azext-utils';
import { MessageItem } from 'vscode';
import { ConnectionType, skipForNow, useEmulator } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { EventHubsNamespaceListStep } from './EventHubsNamespaceListStep';
import { IEventHubsConnectionWizardContext } from './IEventHubsConnectionWizardContext';

export class EventHubsConnectionPromptStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public constructor(private readonly _suppressSkipForNow?: boolean) {
        super();
    }

    public async prompt(context: T): Promise<void> {
        const selectEventNamespaceButton: MessageItem = { title: localize('selectEventHubNamespace', 'Select Event Hub Namespace') };
        const useEmulatorButton: MessageItem = { title: useEmulator };
        const skipForNowButton: MessageItem = { title: skipForNow };

        const message: string = localize('selectEventHubsConnection', 'In order to debug, you must select an Event Hub Namespace for internal use by the Azure Functions runtime.');

        const buttons: MessageItem[] = [selectEventNamespaceButton, useEmulatorButton];
        if (!this._suppressSkipForNow) {
            buttons.push(skipForNowButton);
        }

        const result: MessageItem = await context.ui.showWarningMessage(message, { modal: true }, ...buttons);
        if (result === selectEventNamespaceButton) {
            context.eventHubConnectionType = ConnectionType.Azure;
        } else if (result === useEmulatorButton) {
            context.eventHubConnectionType = ConnectionType.Emulator;
        }

        context.telemetry.properties.eventHubConnectionType = context.eventHubConnectionType || skipForNow;
    }

    public shouldPrompt(context: T): boolean {
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
