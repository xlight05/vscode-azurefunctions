/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import { ConnectionKey, ConnectionType, localEventHubsEmulatorConnectionString } from '../../constants';
import { MismatchBehavior, setLocalAppSetting } from '../../funcConfig/local.settings';
import { getEventHubsConnectionString } from '../../utils/azure';
import { IEventHubsConnectionWizardContext } from './IEventHubsConnectionWizardContext';

export class EventHubsConnectionExecuteStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 240;

    public async execute(context: T): Promise<void> {
        let value: string;
        if (context.eventHubConnectionType === ConnectionType.Emulator) {
            value = localEventHubsEmulatorConnectionString;
        } else {
            value = (await getEventHubsConnectionString(<T & ISubscriptionContext>context)).connectionString;
        }

        await setLocalAppSetting(context, context.projectPath, ConnectionKey.EventHub, value, MismatchBehavior.Overwrite);
    }

    public shouldExecute(context: T): boolean {
        return !!context.eventHubConnectionType && context.eventHubConnectionType !== ConnectionType.Skip;
    }
}
