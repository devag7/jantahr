package expo.modules.googleid

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Google sign-in through Android's Credential Manager: the system account sheet returns a Google ID token issued for
 * the web OAuth client (`webClientId`), with the SHA-256 of `nonce` inside, which the app hands to Supabase
 * (signInWithIdToken). Google checks the app's package and signing certificate against the Android OAuth client in
 * the same Google Cloud project.
 */
class GoogleIdModule : Module() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  override fun definition() = ModuleDefinition {
    Name("GoogleId")

    AsyncFunction("signIn") { webClientId: String, hashedNonce: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_NO_ACTIVITY", "Open JantaHR and try again.", null)
        return@AsyncFunction
      }
      val option = GetSignInWithGoogleOption.Builder(webClientId).setNonce(hashedNonce).build()
      val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
      scope.launch {
        try {
          val credential = CredentialManager.create(activity).getCredential(activity, request).credential
          if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            val google = GoogleIdTokenCredential.createFrom(credential.data)
            promise.resolve(mapOf("idToken" to google.idToken, "email" to google.id, "name" to google.displayName))
          } else {
            promise.reject("ERR_GOOGLE", "Google returned an unexpected kind of sign-in.", null)
          }
        } catch (e: GetCredentialCancellationException) {
          promise.reject("ERR_CANCELED", "Google sign-in was cancelled.", e)
        } catch (e: NoCredentialException) {
          promise.reject("ERR_NO_ACCOUNT", "Add a Google account to this phone first, or sign in with your email.", e)
        } catch (e: Exception) {
          promise.reject("ERR_GOOGLE", e.message ?: "Google sign-in did not complete.", e)
        }
      }
    }

    OnDestroy {
      scope.cancel()
    }
  }
}
