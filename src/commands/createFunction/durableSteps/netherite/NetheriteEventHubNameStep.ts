/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { ConnectionType } from '../../../../constants';
import { invalidLength, invalidLowerCaseAlphanumericWithHyphens, localize } from '../../../../localize';
import { validateUtils } from '../../../../utils/validateUtils';
import { IEventHubsConnectionWizardContext } from '../../../appSettings/IEventHubsConnectionWizardContext';


export class NetheriteEventHubNameStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardPromptStep<T> {
    // private _eventHubNames: string[];

    // public static async isNameAvailable(name: string, context?: ISubscriptionActionContext, stepContext?: NetheriteEventHubNameStep<IEventHubsConnectionWizardContext>): Promise<boolean | undefined> {
    //     if (!stepContext && !context) {
    //         return;
    //     }
    //     if (!stepContext && context) {
    //         client = await createEventHubClient(context);
    //     }

    //     client?.eventHubs.
    // }

    public async prompt(context: T): Promise<void> {
        console.log(context);

        context.newEventHubName = (await context.ui.showInputBox({
            prompt: localize('eventHubNamePrompt', 'Enter a name for the new event hub.'),
            validateInput: (value: string | undefined) => this.validateInput(value)
        })).trim();
    }

    public shouldPrompt(context: T): boolean {
        return !context.newEventHubName && context.eventHubConnectionType !== ConnectionType.None;
    }

    private validateInput(name: string | undefined): string | undefined {
        name = name ? name.trim() : '';

        if (!validateUtils.isValidLength(name, 1, 256)) {
            return invalidLength('1', '256');
        }
        if (!validateUtils.isLowerCaseAlphanumericWithHypens(name)) {
            return invalidLowerCaseAlphanumericWithHyphens;
        }

        // await delay(1000);

        // const isNameAvailable = await NetheriteEventHubNameStep.isNameAvailable(name, undefined, this);
        // if (!isNameAvailable) {
        //     return localize('eventHubExists', 'The event hub you entered already exists. Please enter a unique name.');
        // }

        return undefined;
    }
}
