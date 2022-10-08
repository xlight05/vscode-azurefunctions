/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from '@microsoft/vscode-azext-utils';
import { recommended } from '../../../../constants';
import { localize } from '../../../../localize';
import { IEventHubsConnectionWizardContext } from '../../../appSettings/IEventHubsConnectionWizardContext';

export class EventHubPartitionsStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        // Todo: verify the number of partition counts one can choose
        const placeHolder: string = localize('choosePartitionNumber', 'Choose the number of partitions.');
        const picks: IAzureQuickPickItem<number | undefined>[] = [
            { label: '12', description: recommended, data: 12 },
            { label: '1', data: 1 },
            { label: '32', data: 32 }
        ];
        context.partitionCount = (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    public shouldPrompt(context: T): boolean {
        return !context.partitionCount;
    }
}
