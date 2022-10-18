/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, ISubscriptionActionContext, IWizardOptions } from '@microsoft/vscode-azext-utils';
import { MessageItem } from 'vscode';
import { ConnectionType } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize, skipForNow } from '../../localize';
import { SqlServerListStep } from '../createFunction/durableSteps/sql/SqlServerListStep';
import { IConnectionPromptOptions } from './IConnectionPrompOptions';
import { ISqlDatabaseConnectionWizardContext } from './ISqlDatabaseConnectionWizardContext';
import { SqlDatabaseConnectionCustomPromptStep } from './SqlDatabaseConnectionCustomPromptStep';

export class SqlDatabaseConnectionPromptStep<T extends ISqlDatabaseConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public constructor(private readonly _options?: IConnectionPromptOptions) {
        super();
    }

    public async prompt(context: T): Promise<void> {
        if (this._options?.preSelectedConnectionType) {
            context.sqlDbConnectionType = this._options.preSelectedConnectionType;
            context.telemetry.properties.sqlDbConnectionType = this._options.preSelectedConnectionType;
            return;
        }

        const connectAzureDatabase: MessageItem = { title: localize('connectSqlDatabase', 'Connect Azure SQL Database') };
        const connectNonAzureDatabase: MessageItem = { title: localize('connectSqlDatabase', 'Connect Non-Azure SQL Database') };
        const skipForNowButton: MessageItem = { title: skipForNow };

        const message: string = localize('selectSqlDatabaseConnection', 'In order to proceed, you must connect a SQL database for internal use by the Azure Functions runtime.');

        const buttons: MessageItem[] = [connectAzureDatabase, connectNonAzureDatabase];

        if (!this._options?.suppressSkipForNow) {
            buttons.push(skipForNowButton);
        }

        const result: MessageItem = await context.ui.showWarningMessage(message, { modal: true }, ...buttons);
        if (result === connectAzureDatabase) {
            context.sqlDbConnectionType = ConnectionType.Azure;
        } else if (result === connectNonAzureDatabase) {
            context.sqlDbConnectionType = ConnectionType.NonAzure;
        } else {
            context.sqlDbConnectionType = ConnectionType.None;
        }

        context.telemetry.properties.sqlDbConnectionType = context.sqlDbConnectionType;
    }

    public shouldPrompt(context: T): boolean {
        if (context.azureWebJobsStorageType) {
            context.sqlDbConnectionType = context.azureWebJobsStorageType;
        }
        return !context.sqlDbConnectionType;
    }

    public async getSubWizard(context: T): Promise<IWizardOptions<T & ISubscriptionActionContext> | undefined> {
        if (context.sqlDbConnectionType === ConnectionType.None) {
            return;
        }

        if (context.sqlDbConnectionType === ConnectionType.NonAzure) {
            return { promptSteps: [new SqlDatabaseConnectionCustomPromptStep()] }
        }

        const promptSteps: AzureWizardPromptStep<T & ISubscriptionActionContext>[] = [];

        const subscriptionPromptStep: AzureWizardPromptStep<ISubscriptionActionContext> | undefined = await ext.azureAccountTreeItem.getSubscriptionPromptStep(context);
        if (subscriptionPromptStep) {
            promptSteps.push(subscriptionPromptStep);
        }

        promptSteps.push(new SqlServerListStep());

        return { promptSteps };
    }
}
