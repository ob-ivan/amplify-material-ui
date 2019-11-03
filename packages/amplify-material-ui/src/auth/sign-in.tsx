import * as React from 'react';
import invariant from 'tiny-invariant';
import {
    Button,
    Grid,
    Link,
    makeStyles,
    createStyles,
    Theme,
} from '@material-ui/core';
import Auth from '@aws-amplify/auth';
import { ConsoleLogger as Logger, I18n, JS } from '@aws-amplify/core';
import { Formik, Field, Form } from 'formik';
import { TextField } from 'formik-material-ui';

import { useAuthContext } from './auth-context';
import { FormSection, SectionHeader, SectionBody, SectionFooter } from '../ui';

const logger = new Logger('SignIn');

export interface SignInProps {
    validationData?: { [key: string]: string };
    hideSignUp?: boolean;
    hideForgotPassword?: boolean;
}

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        form: {
            width: '100%', // Fix IE 11 issue.
            marginTop: theme.spacing(1),
        },
        submit: {
            margin: theme.spacing(3, 0, 2),
        },
    }),
);

export const SignIn: React.FC<SignInProps> = props => {
    const { onStateChange } = useAuthContext();
    const {
        validationData,
        hideSignUp = false,
        hideForgotPassword = false,
    } = props;

    const classes = useStyles();

    const checkContact = async (user: any): Promise<void> => {
        invariant(
            Auth && typeof Auth.verifiedContact === 'function',
            'No Auth module found, please ensure @aws-amplify/auth is imported',
        );

        const data = await Auth.verifiedContact(user);

        if (!JS.isEmpty(data.verified)) {
            onStateChange('signedIn', user);
        } else {
            user = { ...user, ...data };
            onStateChange('verifyContact', user);
        }
    };

    const signIn = async (
        username: string,
        password: string,
    ): Promise<void> => {
        if (!Auth || typeof Auth.signIn !== 'function') {
            throw new Error(
                'No Auth module found, please ensure @aws-amplify/auth is imported',
            );
        }

        try {
            const user = await Auth.signIn({
                username,
                password,
                validationData,
            });
            logger.debug(user);
            if (
                user.challengeName === 'SMS_MFA' ||
                user.challengeName === 'SOFTWARE_TOKEN_MFA'
            ) {
                logger.debug('confirm user with ' + user.challengeName);
                onStateChange('confirmSignIn', user);
            } else if (user.challengeName === 'NEW_PASSWORD_REQUIRED') {
                logger.debug('require new password', user.challengeParam);
                onStateChange('requireNewPassword', user);
            } else if (user.challengeName === 'MFA_SETUP') {
                logger.debug('TOTP setup', user.challengeParam);
                onStateChange('TOTPSetup', user);
            } else {
                checkContact(user);
            }
        } catch (err) {
            if (err.code === 'UserNotConfirmedException') {
                logger.debug('the user is not confirmed');
                onStateChange('confirmSignUp', { username });
            } else if (err.code === 'PasswordResetRequiredException') {
                logger.debug('the user requires a new password');
                onStateChange('forgotPassword', { username });
            } else {
                //this.error(err);
                console.log(err);
            }
        } finally {
            //this.setState({ loading: false });
        }
        //onStateChange('signedIn', null); //TODO
    };

    return (
        <Formik<{ username: string; password: string }>
            initialValues={{
                username: '',
                password: '',
            }}
            onSubmit={async (
                { username, password },
                { setSubmitting },
            ): Promise<void> => {
                await signIn(username, password);
                setSubmitting(false);
            }}
        >
            {({ submitForm, isValid }): React.ReactNode => (
                <FormSection>
                    <SectionHeader>
                        {I18n.get('Sign in to your account')}
                    </SectionHeader>
                    <Form className={classes.form} data-testid="signInForm">
                        <SectionBody>
                            <Field
                                variant="outlined"
                                margin="normal"
                                required
                                fullWidth
                                id="username"
                                label="Username"
                                name="username"
                                autoFocus
                                component={TextField}
                            />
                            <Field
                                variant="outlined"
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label={I18n.get('Password')}
                                type="password"
                                id="password"
                                autoComplete="current-password"
                                component={TextField}
                            />
                        </SectionBody>
                        <SectionFooter>
                            <Button
                                onClick={submitForm}
                                disabled={!isValid}
                                fullWidth
                                variant="contained"
                                color="primary"
                                className={classes.submit}
                                data-testid="signInSubmit"
                            >
                                {I18n.get('Sign In')}
                            </Button>
                            <Grid container>
                                {!hideForgotPassword && (
                                    <Grid item xs>
                                        <Link
                                            href="#"
                                            onClick={(): void =>
                                                onStateChange(
                                                    'forgotPassword',
                                                    null,
                                                )
                                            }
                                            variant="body2"
                                        >
                                            {I18n.get('Reset password')}
                                        </Link>
                                    </Grid>
                                )}
                                {!hideSignUp && (
                                    <Grid item>
                                        <Link
                                            href="#"
                                            onClick={(): void =>
                                                onStateChange('signUp', null)
                                            }
                                            variant="body2"
                                        >
                                            {I18n.get('Create account')}
                                        </Link>
                                    </Grid>
                                )}
                            </Grid>
                        </SectionFooter>
                    </Form>
                </FormSection>
            )}
        </Formik>
    );
};
